import { geoCentroid } from 'd3-geo';
import { feature } from 'topojson-client';
import type { FeatureCollection, Geometry } from 'geojson';
import { CanvasTexture, Frustum, Group, MathUtils, Matrix4, Sprite, SpriteMaterial, Vector3 } from 'three';
import type { GeometryCollection } from 'topojson-specification';
import { onBeforeUnmount, onMounted, watch, type Ref } from 'vue';

import { loadTopology } from '@/modules/Globe/services/TopoLoader';
import type { GlobeSceneHandle } from '@/modules/Globe/types/globe.types';
import { latLngTo3D } from '@/modules/Globe/utils/latLngTo3D';

interface CountryFeatureProperties {
    name?: string;
}

interface CountryLabelRecord {
    sprite: Sprite;
    surfaceNormal: Vector3;
}

interface CountryLabelLodConfig {
    readonly minCameraRadius: number;
    readonly labelScaleHeight: number;
}

const COUNTRY_LABEL_RADIUS = 1.001;
// Entries must be sorted highest minCameraRadius first.
const COUNTRY_LABEL_LOD_CONFIGS: readonly CountryLabelLodConfig[] = [
    { minCameraRadius: 5.5, labelScaleHeight: 0.006 },
    { minCameraRadius: 3.0, labelScaleHeight: 0.009 },
    { minCameraRadius: 2.4, labelScaleHeight: 0.011 },
    { minCameraRadius: 1.8, labelScaleHeight: 0.013 },
    { minCameraRadius: 1.3, labelScaleHeight: 0.016 },
    { minCameraRadius: 0, labelScaleHeight: 0.019 },
];

/**
 * Smoothly interpolates labelScaleHeight between adjacent LOD breakpoints so
 * scale never jumps discretely as the camera crosses a threshold.
 */
function resolveCountryLabelScale(cameraRadius: number): number {
    const configs = COUNTRY_LABEL_LOD_CONFIGS;
    // Above the highest breakpoint — clamp to the largest-radius scale.
    if (cameraRadius >= configs[0]!.minCameraRadius) return configs[0]!.labelScaleHeight;
    // Below the lowest breakpoint — clamp to the smallest-radius scale.
    const lastConfig = configs[configs.length - 1]!;
    if (cameraRadius <= lastConfig.minCameraRadius) return lastConfig.labelScaleHeight;

    // Find the two adjacent breakpoints that bracket cameraRadius and lerp.
    for (let configIndex = 0; configIndex < configs.length - 1; configIndex++) {
        const upperConfig = configs[configIndex]!;
        const lowerConfig = configs[configIndex + 1]!;
        if (cameraRadius >= lowerConfig.minCameraRadius) {
            const interpolation = MathUtils.clamp(
                (cameraRadius - lowerConfig.minCameraRadius) /
                    (upperConfig.minCameraRadius - lowerConfig.minCameraRadius),
                0,
                1,
            );
            return MathUtils.lerp(lowerConfig.labelScaleHeight, upperConfig.labelScaleHeight, interpolation);
        }
    }

    return lastConfig.labelScaleHeight;
}

function applyCountryLabelScale(labelSprite: Sprite, aspectRatio: number, labelScaleHeight: number): void {
    labelSprite.scale.set(aspectRatio * labelScaleHeight, labelScaleHeight, 1);
}

function createCountryLabelSprite(label: string): Sprite {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) {
        throw new Error('Failed to create country label canvas context');
    }

    const font = "600 34px 'Segoe UI', system-ui, sans-serif";
    context.font = font;
    const measuredLabel = context.measureText(label);
    const dotRadius = 5;
    const horizontalPadding = 20;
    const dotOffsetX = horizontalPadding + dotRadius;
    const dotGap = 9;
    const textOffsetX = dotOffsetX + dotRadius + dotGap;
    const canvasWidth = Math.max(Math.ceil(measuredLabel.width) + textOffsetX + horizontalPadding, 88);
    const canvasHeight = 52;
    const pillRadius = canvasHeight / 2;

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    context.font = font;
    context.textAlign = 'left';
    context.textBaseline = 'middle';

    // Dark pill background with subtle inner glow border.
    context.save();
    context.beginPath();
    context.roundRect(0, 0, canvasWidth, canvasHeight, pillRadius);
    context.fillStyle = 'rgba(6, 8, 18, 0.84)';
    context.fill();
    context.strokeStyle = 'rgba(255, 255, 255, 0.10)';
    context.lineWidth = 1.5;
    context.stroke();
    context.restore();

    // Accent dot.
    context.save();
    context.beginPath();
    context.arc(dotOffsetX, canvasHeight / 2, dotRadius, 0, Math.PI * 2);
    context.fillStyle = 'rgba(82, 186, 255, 0.92)';
    context.shadowColor = 'rgba(82, 186, 255, 0.7)';
    context.shadowBlur = 8;
    context.fill();
    context.restore();

    // Label text — crisp white, no shadow so it reads cleanly on the dark pill.
    context.save();
    context.fillStyle = 'rgba(232, 237, 255, 0.95)';
    context.fillText(label, textOffsetX, canvasHeight / 2 + 1);
    context.restore();

    const texture = new CanvasTexture(canvas);
    texture.needsUpdate = true;

    const spriteMaterial = new SpriteMaterial({
        map: texture,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        opacity: 0.93,
        sizeAttenuation: false,
    });

    const sprite = new Sprite(spriteMaterial);
    sprite.renderOrder = 2;
    sprite.userData['aspectRatio'] = canvasWidth / canvasHeight;
    return sprite;
}

function disposeCountryLabelSprite(sprite: Sprite): void {
    const spriteMaterial = sprite.material as SpriteMaterial;
    spriteMaterial.map?.dispose();
    spriteMaterial.dispose();
}

export function useGlobeCountryLabels(globeSceneHandleRef: Readonly<Ref<GlobeSceneHandle | null>>): void {
    const labelGroup = new Group();
    labelGroup.name = 'CountryLabels';

    const labelRecords: CountryLabelRecord[] = [];
    const reusableCameraDirection = new Vector3();
    const reusableViewProjectionMatrix = new Matrix4();
    const reusableViewFrustum = new Frustum();
    let visibilityIntervalId: ReturnType<typeof setInterval> | null = null;

    function ensureLabelGroupAttached(): void {
        const scene = globeSceneHandleRef.value?.scene;
        if (!scene) return;
        if (!scene.children.includes(labelGroup)) {
            scene.add(labelGroup);
        }
    }

    async function createCountryLabels(): Promise<void> {
        const topology = await loadTopology('50m');
        const countriesObject = topology.objects['countries'] as GeometryCollection;
        const countriesFeatureCollection = feature(topology, countriesObject) as unknown as FeatureCollection<
            Geometry,
            CountryFeatureProperties
        >;

        for (const countryFeature of countriesFeatureCollection.features) {
            const countryName = countryFeature.properties?.name?.trim() ?? '';
            if (!countryName) continue;

            const [centroidLongitude, centroidLatitude] = geoCentroid(countryFeature);
            const sprite = createCountryLabelSprite(countryName);
            sprite.position.copy(latLngTo3D(centroidLatitude, centroidLongitude, COUNTRY_LABEL_RADIUS));
            sprite.visible = false;
            labelGroup.add(sprite);

            labelRecords.push({
                sprite,
                surfaceNormal: latLngTo3D(centroidLatitude, centroidLongitude, 1),
            });
        }

        ensureLabelGroupAttached();
        updateCountryLabelVisibility();
    }

    function updateCountryLabelVisibility(): void {
        const globeSceneHandle = globeSceneHandleRef.value;
        if (!globeSceneHandle) return;

        const camera = globeSceneHandle.camera;
        const cameraPosition = camera.position;
        const cameraRadius = cameraPosition.length();
        const minimumVisibleDot = 1 / Math.max(cameraRadius, 1.0001);
        const labelScaleHeight = resolveCountryLabelScale(cameraRadius);

        camera.updateMatrixWorld();
        reusableViewProjectionMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
        reusableViewFrustum.setFromProjectionMatrix(reusableViewProjectionMatrix);
        reusableCameraDirection.copy(cameraPosition).normalize();

        for (const labelRecord of labelRecords) {
            const aspectRatio = Number(labelRecord.sprite.userData['aspectRatio'] ?? 1);
            applyCountryLabelScale(labelRecord.sprite, aspectRatio, labelScaleHeight);

            const isFacingCamera = labelRecord.surfaceNormal.dot(reusableCameraDirection) >= minimumVisibleDot;
            if (!isFacingCamera) {
                labelRecord.sprite.visible = false;
                continue;
            }

            labelRecord.sprite.visible = reusableViewFrustum.containsPoint(labelRecord.sprite.position);
        }
    }

    function startVisibilityLoop(): void {
        if (visibilityIntervalId !== null) return;
        visibilityIntervalId = setInterval(updateCountryLabelVisibility, 180);
    }

    function stopVisibilityLoop(): void {
        if (visibilityIntervalId === null) return;
        clearInterval(visibilityIntervalId);
        visibilityIntervalId = null;
    }

    watch(globeSceneHandleRef, () => {
        ensureLabelGroupAttached();
        updateCountryLabelVisibility();
    });

    onMounted(() => {
        ensureLabelGroupAttached();
        startVisibilityLoop();
        void createCountryLabels().catch((error) => {
            console.error('[Globe] Failed to build country labels', error);
        });
    });

    onBeforeUnmount(() => {
        stopVisibilityLoop();
        for (const labelRecord of labelRecords) {
            disposeCountryLabelSprite(labelRecord.sprite);
        }
        labelRecords.length = 0;
        labelGroup.clear();
    });
}
