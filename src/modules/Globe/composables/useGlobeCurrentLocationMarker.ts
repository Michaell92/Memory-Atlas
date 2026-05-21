import { CanvasTexture, Group, Sprite, SpriteMaterial } from 'three';
import gsap from 'gsap';
import { onBeforeUnmount, watch, type Ref } from 'vue';

import type { GlobeSceneHandle } from '@/modules/Globe/types/globe.types';
import { latLngTo3D } from '@/modules/Globe/utils/latLngTo3D';
import { useUserStore } from '@/modules/User/stores/userStore';

const CURRENT_LOCATION_MARKER_RADIUS = 1.018;
const BASE_CORE_SCALE = 0.0425;
const BASE_PULSE_SCALE = 0.08;
const BASE_PULSE_EXPANDED_SCALE = 0.14;
const BASE_CORE_PULSE_SCALE = 0.046;
const FAR_CAMERA_RADIUS = 3.2;
const NEAR_CAMERA_RADIUS = 1.02;

function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

function resolveMarkerZoomScale(cameraRadius: number): number {
    const normalizedZoom = (FAR_CAMERA_RADIUS - cameraRadius) / (FAR_CAMERA_RADIUS - NEAR_CAMERA_RADIUS);
    const clampedZoom = clamp(normalizedZoom, 0, 1);
    return 1 - clampedZoom * 0.55;
}

function createMarkerTexture(innerColor: string, outerColor: string): CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;

    const context = canvas.getContext('2d');
    if (!context) {
        throw new Error('Current location marker texture could not get a 2D context.');
    }

    const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, innerColor);
    gradient.addColorStop(0.32, outerColor);
    gradient.addColorStop(1, 'rgba(255, 89, 89, 0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 128, 128);

    return new CanvasTexture(canvas);
}

export function useGlobeCurrentLocationMarker(globeSceneHandleRef: Readonly<Ref<GlobeSceneHandle | null>>): void {
    const userStore = useUserStore();

    const markerGroup = new Group();
    const coreTexture = createMarkerTexture('rgba(255, 255, 255, 1)', 'rgba(255, 89, 89, 0.95)');
    const pulseTexture = createMarkerTexture('rgba(255, 120, 120, 0.35)', 'rgba(255, 89, 89, 0.18)');

    const coreMaterial = new SpriteMaterial({
        map: coreTexture,
        transparent: true,
        depthTest: false,
        depthWrite: false,
    });
    const pulseMaterial = new SpriteMaterial({
        map: pulseTexture,
        transparent: true,
        depthTest: false,
        depthWrite: false,
    });

    const coreSprite = new Sprite(coreMaterial);
    coreSprite.scale.setScalar(BASE_CORE_SCALE);
    coreSprite.renderOrder = 30;

    const pulseSprite = new Sprite(pulseMaterial);
    pulseSprite.scale.setScalar(BASE_PULSE_SCALE);
    pulseSprite.renderOrder = 29;

    markerGroup.renderOrder = 29;

    markerGroup.add(pulseSprite);
    markerGroup.add(coreSprite);

    const pulseTimeline = gsap.timeline({ repeat: -1, defaults: { ease: 'sine.out' } });
    pulseTimeline
        .to(
            pulseSprite.scale,
            {
                x: BASE_PULSE_EXPANDED_SCALE,
                y: BASE_PULSE_EXPANDED_SCALE,
                duration: 1.35,
            },
            0,
        )
        .to(
            pulseMaterial,
            {
                opacity: 0.18,
                duration: 1.35,
            },
            0,
        )
        .to(
            coreSprite.scale,
            {
                x: BASE_CORE_PULSE_SCALE,
                y: BASE_CORE_PULSE_SCALE,
                duration: 0.68,
                yoyo: true,
                repeat: 1,
            },
            0,
        );

    const updateMarkerScale = (): void => {
        const globeSceneHandle = globeSceneHandleRef.value;
        if (!globeSceneHandle || !markerGroup.parent) return;

        const cameraRadius = globeSceneHandle.camera.position.length();
        const zoomScale = resolveMarkerZoomScale(cameraRadius);
        markerGroup.scale.setScalar(zoomScale);
    };

    gsap.ticker.add(updateMarkerScale);

    function detachMarker(): void {
        markerGroup.removeFromParent();
    }

    watch(
        [globeSceneHandleRef, () => userStore.currentLocation],
        ([globeSceneHandle, currentLocation]) => {
            detachMarker();

            if (!globeSceneHandle || !currentLocation) return;

            markerGroup.position.copy(
                latLngTo3D(currentLocation.latitude, currentLocation.longitude, CURRENT_LOCATION_MARKER_RADIUS),
            );
            globeSceneHandle.scene.add(markerGroup);
            updateMarkerScale();
        },
        { immediate: true },
    );

    onBeforeUnmount(() => {
        detachMarker();
        gsap.ticker.remove(updateMarkerScale);
        pulseTimeline.kill();
        coreMaterial.dispose();
        pulseMaterial.dispose();
        coreTexture.dispose();
        pulseTexture.dispose();
    });
}
