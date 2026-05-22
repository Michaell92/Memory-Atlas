<template>
    <div class="globe-view">
        <canvas
            ref="canvasRef"
            class="globe-view__canvas"
            @pointermove="handleCanvasPointerMove"
            @pointerleave="handleCanvasPointerLeave"
        />
        <div v-if="lastDetectedCountry" class="globe-view__hit-debug">
            <span v-if="lastDetectedCity && lastDetectedCountry"
                >{{ lastDetectedCity.name }}, {{ lastDetectedCountry.countryName }}</span
            >
            <span v-else>{{ lastDetectedCountry.countryName }}</span>
        </div>

        <Transition name="globe-view__locked-tooltip">
            <div
                v-if="hoveredLockedCountry && lockedCountryTooltipStyle"
                class="globe-view__locked-tooltip"
                :style="lockedCountryTooltipStyle"
            >
                Add a memory to unlock!
            </div>
        </Transition>

        <Transition name="globe-view__celebration">
            <div v-if="activeCelebration" :key="activeCelebration.token" class="globe-view__celebration">
                <div class="globe-view__celebration-orbit globe-view__celebration-orbit--outer" />
                <div class="globe-view__celebration-orbit globe-view__celebration-orbit--inner" />
                <p class="globe-view__celebration-eyebrow">Country unlocked</p>
                <h2 class="globe-view__celebration-title">{{ activeCelebration.countryName }}</h2>
                <p class="globe-view__celebration-copy">A new glow just came online in your atlas.</p>
            </div>
        </Transition>

        <MemoryModal />
        <AppLoader v-if="!isEarthReady" label="Mapping your world…" />
    </div>
</template>

<script setup vapor lang="ts">
import { computed, ref, useTemplateRef } from 'vue';
import { Raycaster, Vector2 } from 'three';

import { useGlobeCityLayer } from '@/modules/Globe/composables/useGlobeCityLayer';
import { useGlobeCityMarkers } from '@/modules/Globe/composables/useGlobeCityMarkers';
import { useCountryUnlockCelebration } from '@/modules/Globe/composables/useCountryUnlockCelebration';
import { useGlobeCurrentLocationMarker } from '@/modules/Globe/composables/useGlobeCurrentLocationMarker';
import { useGlobeLockedCountries } from '@/modules/Globe/composables/useGlobeLockedCountries';
import { useGlobeRaycaster } from '@/modules/Globe/composables/useGlobeRaycaster';
import { useGlobeScene } from '@/modules/Globe/composables/useGlobeScene';
import { createGeoLookup, type GeoLookupHandle } from '@/modules/Globe/services/GeoLookup';
import type { DetectedCountry } from '@/modules/Globe/types/globe.types';
import MemoryModal from '@/modules/Memory/components/MemoryModal.vue';
import { useMemoryModal } from '@/modules/Memory/composables/useMemoryModal';
import { useMemoryStore } from '@/modules/Memory/stores/memoryStore';
import AppLoader from '@/shared/components/AppLoader.vue';
import type { City } from '@/shared/types/city.types';

function normalizeCountryKey(value: string): string {
    return value.trim().toLocaleLowerCase();
}

function createCursorValue(svgMarkup: string, fallback: string): string {
    return `url("data:image/svg+xml,${encodeURIComponent(svgMarkup)}") 10 6, ${fallback}`;
}

const lockedCountryLabelCursor = createCursorValue(
    `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><path d="M5 3l9 22 2-8 8-2z" fill="#f4f7ff" stroke="#0b1023" stroke-width="1.5" stroke-linejoin="round"/><circle cx="24" cy="10" r="6" fill="#12172d" stroke="#ffd27a" stroke-width="2"/><text x="24" y="13" font-size="10" text-anchor="middle" fill="#ffd27a" font-family="Segoe UI, sans-serif">?</text></svg>`,
    'pointer',
);

const canvasRef = useTemplateRef<HTMLCanvasElement>('canvasRef');

const { globeSceneHandle, isEarthReady } = useGlobeScene(canvasRef);
const memoryModal = useMemoryModal();
const memoryStore = useMemoryStore();
const { activeCelebration } = useCountryUnlockCelebration();
const { cachedCities } = useGlobeCityLayer(globeSceneHandle);
const { getIntersectedCity } = useGlobeCityMarkers(globeSceneHandle, cachedCities, canvasRef);
const { hoveredLockedCountry, tooltipPosition, clearHoverState, getIntersectedLockedCountryLabel, updateHoverState } =
    useGlobeLockedCountries(canvasRef, globeSceneHandle);
useGlobeCurrentLocationMarker(globeSceneHandle);

const lastDetectedCountry = ref<DetectedCountry | null>(null);
const lastDetectedCity = ref<City | null>(null);

const hoverRaycaster = new Raycaster();
const hoverPointerNdc = new Vector2();

const lockedCountryTooltipStyle = computed(() => {
    if (!hoveredLockedCountry.value || !tooltipPosition.value) return null;

    return {
        left: `${tooltipPosition.value.x}px`,
        top: `${tooltipPosition.value.y - 26}px`,
    };
});

let geoLookupHandle: GeoLookupHandle | null = null;
createGeoLookup('110m')
    .then((handle) => {
        geoLookupHandle = handle;
    })
    .catch((error) => {
        console.error('[Globe] Failed to load geo lookup', error);
    });

function setCanvasCursor(cursor: string): void {
    if (!canvasRef.value) return;
    canvasRef.value.style.cursor = cursor;
}

function updatePointerRaycaster(event: PointerEvent): boolean {
    const canvas = canvasRef.value;
    const globeScene = globeSceneHandle.value;
    if (!canvas || !globeScene) return false;

    const { left, top, width, height } = canvas.getBoundingClientRect();
    hoverPointerNdc.set(((event.clientX - left) / width) * 2 - 1, -((event.clientY - top) / height) * 2 + 1);
    hoverRaycaster.setFromCamera(hoverPointerNdc, globeScene.camera);
    return true;
}

function handleCanvasPointerMove(event: PointerEvent): void {
    updateHoverState(event.clientX, event.clientY);

    if (!updatePointerRaycaster(event)) {
        setCanvasCursor('');
        return;
    }

    const hoveredCity = getIntersectedCity(hoverRaycaster);

    if (hoveredLockedCountry.value) {
        setCanvasCursor(lockedCountryLabelCursor);
        return;
    }

    if (hoveredCity) {
        setCanvasCursor('pointer');
        return;
    }

    setCanvasCursor('');
}

function handleCanvasPointerLeave(): void {
    clearHoverState();
    setCanvasCursor('');
}

function isCountryUnlocked(countryCode: string, countryName: string): boolean {
    const normalizedCountryName = normalizeCountryKey(countryName);

    return memoryStore.memories.some((memory) => {
        if (memory.countryCode === countryCode) return true;
        return normalizeCountryKey(memory.countryName) === normalizedCountryName;
    });
}

const { raycaster } = useGlobeRaycaster(
    canvasRef,
    globeSceneHandle,
    (hit) => {
        const clickedLockedCountryLabel = getIntersectedLockedCountryLabel(raycaster);
        if (
            clickedLockedCountryLabel &&
            !isCountryUnlocked(clickedLockedCountryLabel.countryCode, clickedLockedCountryLabel.countryName)
        ) {
            lastDetectedCountry.value = clickedLockedCountryLabel;
            lastDetectedCity.value = null;
            memoryModal.openAtCountry(
                clickedLockedCountryLabel.countryCode,
                clickedLockedCountryLabel.countryName,
                hit.lat,
                hit.lng,
                'locked',
            );
            return;
        }

        const detectedCountry = geoLookupHandle?.detectCountry(hit.lat, hit.lng) ?? null;
        const detectedCity = detectedCountry ? getIntersectedCity(raycaster) : null;

        lastDetectedCountry.value = detectedCountry;
        lastDetectedCity.value = detectedCity;

        if (detectedCountry) {
            const isUnlockedCountry = isCountryUnlocked(detectedCountry.countryCode, detectedCountry.countryName);

            console.log(
                `[Globe] ${detectedCity ? `${detectedCity.name}, ` : ''}${detectedCountry.countryName} ` +
                    `(${hit.lat.toFixed(2)}°, ${hit.lng.toFixed(2)}°)`,
            );

            if (!isUnlockedCountry) {
                memoryModal.openAtCountry(
                    detectedCountry.countryCode,
                    detectedCountry.countryName,
                    hit.lat,
                    hit.lng,
                    'locked',
                );
                return;
            }

            if (detectedCity) {
                memoryModal.openAtCity(
                    detectedCity.id,
                    detectedCity.name,
                    detectedCountry.countryCode,
                    detectedCountry.countryName,
                    detectedCity.lat,
                    detectedCity.lng,
                );
            } else {
                memoryModal.openAtCountry(
                    detectedCountry.countryCode,
                    detectedCountry.countryName,
                    hit.lat,
                    hit.lng,
                    'unlocked',
                );
            }
        } else {
            console.log(`[Globe] Ocean (${hit.lat.toFixed(2)}°, ${hit.lng.toFixed(2)}°)`);
        }
    },
    () => {
        lastDetectedCountry.value = null;
        lastDetectedCity.value = null;
    },
);
</script>

<style lang="scss" scoped>
.globe-view {
    @include absolute-fill;

    &__canvas {
        width: 100%;
        height: 100%;
        display: block;
    }

    &__hit-debug {
        position: absolute;
        bottom: 1rem;
        left: 50%;
        transform: translateX(-50%);
        padding: 0.375rem 0.75rem;
        border-radius: 0.5rem;
        background: rgba(0, 0, 0, 0.6);
        color: #7ef7c0;
        font-family: monospace;
        font-size: 0.8125rem;
        pointer-events: none;
        white-space: nowrap;
    }

    &__locked-tooltip {
        position: fixed;
        z-index: 18;
        transform: translate(-50%, -100%);
        padding: 0.4375rem 0.6875rem;
        border-radius: 999rem;
        border: 1px solid rgba(255, 210, 122, 0.28);
        background: rgba(6, 9, 20, 0.92);
        color: #ffd27a;
        font-size: 0.75rem;
        letter-spacing: 0.04em;
        white-space: nowrap;
        pointer-events: none;
        box-shadow: 0 0.625rem 1.5rem rgba(2, 3, 10, 0.32);
    }

    &__celebration {
        position: absolute;
        top: 1.5rem;
        left: 50%;
        z-index: 24;
        width: min(26rem, calc(100vw - 2rem));
        padding: 1.125rem 1.25rem 1.25rem;
        border-radius: 1.25rem;
        border: 1px solid rgba(255, 210, 122, 0.28);
        background: radial-gradient(circle at top, rgba(255, 210, 122, 0.22), transparent 42%), rgba(6, 9, 20, 0.94);
        color: #f7f4ec;
        transform: translateX(-50%);
        text-align: center;
        overflow: hidden;
        box-shadow:
            0 1rem 2.2rem rgba(2, 3, 10, 0.38),
            0 0 2.25rem rgba(255, 210, 122, 0.16);
    }

    &__celebration-orbit {
        position: absolute;
        inset: 50% auto auto 50%;
        border-radius: 50%;
        border: 1px solid rgba(255, 210, 122, 0.18);
        transform: translate(-50%, -50%);
        animation: globe-view-orbit-pulse 2.4s ease-out infinite;

        &--outer {
            width: 17rem;
            height: 17rem;
        }

        &--inner {
            width: 11rem;
            height: 11rem;
            animation-delay: 180ms;
        }
    }

    &__celebration-eyebrow {
        position: relative;
        margin: 0 0 0.375rem;
        font-size: 0.75rem;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: #ffd27a;
    }

    &__celebration-title {
        position: relative;
        margin: 0;
        font-size: 1.75rem;
        line-height: 1.1;
    }

    &__celebration-copy {
        position: relative;
        margin: 0.5rem 0 0;
        font-size: 0.875rem;
        color: rgba(233, 236, 255, 0.76);
    }
}

.globe-view__locked-tooltip-enter-active,
.globe-view__locked-tooltip-leave-active,
.globe-view__celebration-enter-active,
.globe-view__celebration-leave-active {
    transition:
        opacity 180ms ease,
        transform 180ms ease;
}

.globe-view__locked-tooltip-enter-from,
.globe-view__locked-tooltip-leave-to,
.globe-view__celebration-enter-from,
.globe-view__celebration-leave-to {
    opacity: 0;
}

.globe-view__locked-tooltip-enter-from,
.globe-view__locked-tooltip-leave-to {
    transform: translate(-50%, -84%);
}

.globe-view__celebration-enter-from,
.globe-view__celebration-leave-to {
    transform: translateX(-50%) translateY(-0.625rem);
}

@keyframes globe-view-orbit-pulse {
    0% {
        opacity: 0.12;
        transform: translate(-50%, -50%) scale(0.9);
    }

    55% {
        opacity: 0.32;
    }

    100% {
        opacity: 0;
        transform: translate(-50%, -50%) scale(1.08);
    }
}
</style>
