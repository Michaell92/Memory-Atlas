import { geoCentroid } from 'd3-geo';
import { feature } from 'topojson-client';
import type { FeatureCollection, Geometry } from 'geojson';
import {
    CanvasTexture,
    Color,
    Frustum,
    Group,
    Matrix4,
    Mesh,
    MeshStandardMaterial,
    Raycaster,
    Sprite,
    SpriteMaterial,
    Vector2,
    Vector3,
} from 'three';
import type { GeometryCollection } from 'topojson-specification';
import { computed, onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue';

import { loadTopology } from '@/modules/Globe/services/TopoLoader';
import type { DetectedCountry, GlobeSceneHandle } from '@/modules/Globe/types/globe.types';
import { latLngTo3D } from '@/modules/Globe/utils/latLngTo3D';
import { useMemoryStore } from '@/modules/Memory/stores/memoryStore';

interface CountryFeatureProperties {
    name?: string;
}

interface LockedCountryLabelRecord {
    country: DetectedCountry;
    sprite: Sprite;
    surfaceNormal: Vector3;
}

interface CountryMeshAppearanceRecord {
    mesh: Mesh;
    material: MeshStandardMaterial;
    baseColor: Color;
    baseEmissive: Color;
    baseEmissiveIntensity: number;
    baseRoughness: number;
    baseMetalness: number;
}

interface TooltipPosition {
    x: number;
    y: number;
}

const LOCKED_COUNTRY_LABEL_RADIUS = 1.03;
const LOCKED_COUNTRY_SURFACE_COLOR = '#05070d';
const LOCKED_COUNTRY_EMISSIVE_COLOR = '#0c1a2b';

interface LockedCountryLabelLodConfig {
    readonly minCameraRadius: number;
    readonly labelScaleHeight: number;
}

const LOCKED_COUNTRY_LABEL_LOD_CONFIGS: readonly LockedCountryLabelLodConfig[] = [
    { minCameraRadius: 3.0, labelScaleHeight: 0.016 },
    { minCameraRadius: 2.4, labelScaleHeight: 0.0155 },
    { minCameraRadius: 1.8, labelScaleHeight: 0.015 },
    { minCameraRadius: 1.3, labelScaleHeight: 0.014 },
    { minCameraRadius: 0, labelScaleHeight: 0.0135 },
];

function normalizeCountryKey(value: string): string {
    return value.trim().toLocaleLowerCase();
}

function resolveLockedCountryLabelScale(cameraRadius: number): number {
    for (const config of LOCKED_COUNTRY_LABEL_LOD_CONFIGS) {
        if (cameraRadius >= config.minCameraRadius) return config.labelScaleHeight;
    }

    return LOCKED_COUNTRY_LABEL_LOD_CONFIGS[LOCKED_COUNTRY_LABEL_LOD_CONFIGS.length - 1]!.labelScaleHeight;
}

function applyLockedCountryLabelScale(labelSprite: Sprite, aspectRatio: number, labelScaleHeight: number): void {
    labelSprite.scale.set(aspectRatio * labelScaleHeight, labelScaleHeight, 1);
}

function createLockedCountryLabelSprite(label: string): Sprite {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) {
        throw new Error('Failed to create locked country label canvas context');
    }

    context.font = "500 36px 'Segoe UI', system-ui, sans-serif";
    const measuredLabel = context.measureText(label);
    const dotRadius = 7;
    const horizontalPadding = 16;
    const dotOffsetX = horizontalPadding + dotRadius;
    const textOffsetX = dotOffsetX + dotRadius + 10;
    const canvasWidth = Math.max(Math.ceil(measuredLabel.width) + textOffsetX + horizontalPadding, 88);
    const canvasHeight = 52;

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    context.font = "500 36px 'Segoe UI', system-ui, sans-serif";
    context.textAlign = 'left';
    context.textBaseline = 'middle';
    context.fillStyle = 'rgba(198, 203, 222, 0.82)';
    context.shadowColor = 'rgba(2, 3, 10, 0.92)';
    context.shadowBlur = 12;
    context.beginPath();
    context.fillStyle = 'rgba(74, 179, 255, 0.96)';
    context.arc(dotOffsetX, canvasHeight / 2, dotRadius, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = 'rgba(198, 203, 222, 0.82)';
    context.fillText(label, textOffsetX, canvasHeight / 2 + 1);

    const texture = new CanvasTexture(canvas);
    texture.needsUpdate = true;

    const spriteMaterial = new SpriteMaterial({
        map: texture,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        opacity: 0.9,
        sizeAttenuation: false,
    });

    const sprite = new Sprite(spriteMaterial);
    sprite.renderOrder = 2;
    const aspectRatio = canvasWidth / canvasHeight;
    sprite.userData['aspectRatio'] = aspectRatio;
    return sprite;
}

function disposeLockedCountryLabel(sprite: Sprite): void {
    const spriteMaterial = sprite.material as SpriteMaterial;
    spriteMaterial.map?.dispose();
    spriteMaterial.dispose();
}

function projectPointerToNdc(canvas: HTMLCanvasElement, clientX: number, clientY: number, output: Vector2): void {
    const { left, top, width, height } = canvas.getBoundingClientRect();
    output.set(((clientX - left) / width) * 2 - 1, -((clientY - top) / height) * 2 + 1);
}

export function useGlobeLockedCountries(
    canvasRef: Readonly<Ref<HTMLCanvasElement | null>>,
    globeSceneHandleRef: Readonly<Ref<GlobeSceneHandle | null>>,
) {
    const memoryStore = useMemoryStore();

    const hoveredLockedCountry = ref<DetectedCountry | null>(null);
    const hoveredLockedCountryLabel = ref<DetectedCountry | null>(null);
    const tooltipPosition = ref<TooltipPosition | null>(null);

    const labelGroup = new Group();
    labelGroup.name = 'LockedCountryLabels';

    const labelRecords = new Map<string, LockedCountryLabelRecord>();
    const countryMeshAppearances = new Map<string, CountryMeshAppearanceRecord>();
    const spriteToCountryKey = new Map<Sprite, string>();

    const hoverRaycaster = new Raycaster();
    const hoverPointerNdc = new Vector2();
    const reusableProjectedPosition = new Vector3();
    const reusableCameraDirection = new Vector3();
    const reusableViewProjectionMatrix = new Matrix4();
    const reusableViewFrustum = new Frustum();
    let visibilityIntervalId: ReturnType<typeof setInterval> | null = null;

    const visibleLabelSprites = computed(() => {
        const sprites: Sprite[] = [];
        for (const labelRecord of labelRecords.values()) {
            if (labelRecord.sprite.visible) {
                sprites.push(labelRecord.sprite);
            }
        }
        return sprites;
    });

    function buildCountryKey(countryCode: string, countryName: string): string {
        return `${countryCode}::${countryName.toLocaleLowerCase()}`;
    }

    function isCountryUnlocked(countryCode: string, countryName: string): boolean {
        const normalizedCountryName = normalizeCountryKey(countryName);

        return memoryStore.memories.some((memory) => {
            if (memory.countryCode === countryCode) return true;
            return normalizeCountryKey(memory.countryName) === normalizedCountryName;
        });
    }

    function ensureLabelGroupAttached(): void {
        const scene = globeSceneHandleRef.value?.scene;
        if (!scene) return;
        if (!scene.children.includes(labelGroup)) {
            scene.add(labelGroup);
        }
    }

    function ensureCountryMeshAppearances(): void {
        const countryMeshes = globeSceneHandleRef.value?.countryMeshes;
        if (!countryMeshes) return;

        for (const child of countryMeshes.children) {
            const mesh = child as Mesh;
            const material = mesh.material;
            if (!(material instanceof MeshStandardMaterial)) continue;

            const countryCode = String(mesh.userData['countryCode'] ?? '');
            const countryName = String(mesh.userData['countryName'] ?? '').trim();
            if (!countryName) continue;

            const countryKey = buildCountryKey(countryCode, countryName);
            if (countryMeshAppearances.has(countryKey)) continue;

            countryMeshAppearances.set(countryKey, {
                mesh,
                material,
                baseColor: material.color.clone(),
                baseEmissive: material.emissive.clone(),
                baseEmissiveIntensity: material.emissiveIntensity,
                baseRoughness: material.roughness,
                baseMetalness: material.metalness,
            });
        }
    }

    function updateCountryMeshAppearance(): void {
        ensureCountryMeshAppearances();

        for (const [countryKey, appearance] of countryMeshAppearances) {
            const [countryCode, countryName = ''] = countryKey.split('::');
            const isUnlocked = isCountryUnlocked(countryCode, countryName);

            if (isUnlocked) {
                appearance.material.color.copy(appearance.baseColor);
                appearance.material.emissive.copy(appearance.baseEmissive);
                appearance.material.emissiveIntensity = appearance.baseEmissiveIntensity;
                appearance.material.roughness = appearance.baseRoughness;
                appearance.material.metalness = appearance.baseMetalness;
                continue;
            }

            appearance.material.color.set(LOCKED_COUNTRY_SURFACE_COLOR);
            appearance.material.emissive.set(LOCKED_COUNTRY_EMISSIVE_COLOR);
            appearance.material.emissiveIntensity = 0.004;
            appearance.material.roughness = 1;
            appearance.material.metalness = 0;
        }
    }

    async function createLockedCountryLabels(): Promise<void> {
        const topology = await loadTopology('50m');
        const countriesObject = topology.objects['countries'] as GeometryCollection;
        const countriesFeatureCollection = feature(topology, countriesObject) as unknown as FeatureCollection<
            Geometry,
            CountryFeatureProperties
        >;

        for (const countryFeature of countriesFeatureCollection.features) {
            const countryCode = String(countryFeature.id ?? '');
            const countryName = countryFeature.properties?.name?.trim() ?? '';
            if (!countryName) continue;

            const [centroidLongitude, centroidLatitude] = geoCentroid(countryFeature);
            const country = { countryCode, countryName } satisfies DetectedCountry;
            const countryKey = buildCountryKey(countryCode, countryName);
            const sprite = createLockedCountryLabelSprite(countryName);
            const spritePosition = latLngTo3D(centroidLatitude, centroidLongitude, LOCKED_COUNTRY_LABEL_RADIUS);

            sprite.position.copy(spritePosition);
            sprite.visible = false;
            labelGroup.add(sprite);

            labelRecords.set(countryKey, {
                country,
                sprite,
                surfaceNormal: latLngTo3D(centroidLatitude, centroidLongitude, 1),
            });
            spriteToCountryKey.set(sprite, countryKey);
        }

        ensureLabelGroupAttached();
        updateLockedCountryLabelVisibility();
    }

    function updateLockedCountryLabelVisibility(): void {
        const globeSceneHandle = globeSceneHandleRef.value;
        if (!globeSceneHandle) return;

        updateCountryMeshAppearance();

        const camera = globeSceneHandle.camera;
        const cameraPosition = camera.position;
        const cameraRadius = cameraPosition.length();
        const minimumVisibleDot = 1 / Math.max(cameraRadius, 1.0001);
        const labelScaleHeight = resolveLockedCountryLabelScale(cameraRadius);

        camera.updateMatrixWorld();
        reusableViewProjectionMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
        reusableViewFrustum.setFromProjectionMatrix(reusableViewProjectionMatrix);
        reusableCameraDirection.copy(cameraPosition).normalize();

        for (const labelRecord of labelRecords.values()) {
            const isUnlocked = isCountryUnlocked(labelRecord.country.countryCode, labelRecord.country.countryName);
            const aspectRatio = Number(labelRecord.sprite.userData['aspectRatio'] ?? 1);

            applyLockedCountryLabelScale(labelRecord.sprite, aspectRatio, labelScaleHeight);

            if (isUnlocked) {
                labelRecord.sprite.visible = false;
                continue;
            }

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
        visibilityIntervalId = setInterval(updateLockedCountryLabelVisibility, 180);
    }

    function stopVisibilityLoop(): void {
        if (visibilityIntervalId === null) return;
        clearInterval(visibilityIntervalId);
        visibilityIntervalId = null;
    }

    function clearHoverState(): void {
        hoveredLockedCountry.value = null;
        hoveredLockedCountryLabel.value = null;
        tooltipPosition.value = null;
    }

    function getIntersectedLockedCountryLabel(raycaster: Raycaster): DetectedCountry | null {
        const camera = globeSceneHandleRef.value?.camera;
        if (!camera) return null;

        raycaster.camera = camera;
        const intersections = raycaster.intersectObjects(visibleLabelSprites.value, false);
        const hitSprite = intersections[0]?.object as Sprite | undefined;
        if (!hitSprite) return null;

        const countryKey = spriteToCountryKey.get(hitSprite);
        if (!countryKey) return null;
        return labelRecords.get(countryKey)?.country ?? null;
    }

    function getIntersectedLockedCountryMesh(raycaster: Raycaster): DetectedCountry | null {
        const countryMeshes = globeSceneHandleRef.value?.countryMeshes;
        if (!countryMeshes) return null;

        const intersections = raycaster.intersectObjects(countryMeshes.children, false);
        for (const intersection of intersections) {
            const countryCode = String(intersection.object.userData['countryCode'] ?? '');
            const countryName = String(intersection.object.userData['countryName'] ?? '').trim();
            if (!countryName) continue;
            if (isCountryUnlocked(countryCode, countryName)) continue;
            return { countryCode, countryName };
        }

        return null;
    }

    function updateHoverState(clientX: number, clientY: number): void {
        const canvas = canvasRef.value;
        const globeSceneHandle = globeSceneHandleRef.value;
        if (!canvas || !globeSceneHandle) {
            clearHoverState();
            return;
        }

        projectPointerToNdc(canvas, clientX, clientY, hoverPointerNdc);
        hoverRaycaster.setFromCamera(hoverPointerNdc, globeSceneHandle.camera);

        const intersectedLabelCountry = getIntersectedLockedCountryLabel(hoverRaycaster);
        const intersectedMeshCountry = getIntersectedLockedCountryMesh(hoverRaycaster);

        hoveredLockedCountryLabel.value = intersectedLabelCountry;
        hoveredLockedCountry.value = intersectedLabelCountry ?? intersectedMeshCountry;

        if (!hoveredLockedCountry.value) {
            tooltipPosition.value = null;
            return;
        }

        if (!intersectedLabelCountry) {
            tooltipPosition.value = {
                x: clientX,
                y: clientY,
            };
            return;
        }

        const labelRecord = labelRecords.get(
            buildCountryKey(intersectedLabelCountry.countryCode, intersectedLabelCountry.countryName),
        );
        if (!labelRecord) {
            tooltipPosition.value = null;
            return;
        }

        reusableProjectedPosition.copy(labelRecord.sprite.position).project(globeSceneHandle.camera);
        const { left, top, width, height } = canvas.getBoundingClientRect();
        tooltipPosition.value = {
            x: left + (reusableProjectedPosition.x + 1) * 0.5 * width,
            y: top + (-reusableProjectedPosition.y + 1) * 0.5 * height,
        };
    }

    watch(globeSceneHandleRef, () => {
        ensureLabelGroupAttached();
        ensureCountryMeshAppearances();
        updateLockedCountryLabelVisibility();
    });

    watch(
        () => memoryStore.memories,
        () => {
            updateLockedCountryLabelVisibility();
        },
    );

    onMounted(() => {
        ensureLabelGroupAttached();
        startVisibilityLoop();
        void createLockedCountryLabels().catch((error) => {
            console.error('[Globe] Failed to build locked country labels', error);
        });
    });

    onBeforeUnmount(() => {
        stopVisibilityLoop();
        clearHoverState();
        for (const labelRecord of labelRecords.values()) {
            disposeLockedCountryLabel(labelRecord.sprite);
        }
        countryMeshAppearances.clear();
        labelRecords.clear();
        spriteToCountryKey.clear();
        labelGroup.clear();
    });

    return {
        hoveredLockedCountry,
        hoveredLockedCountryLabel,
        tooltipPosition,
        clearHoverState,
        getIntersectedLockedCountryLabel,
        updateHoverState,
    };
}
