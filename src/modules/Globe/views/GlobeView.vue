<template>
    <div class="globe-view">
        <canvas ref="canvasRef" class="globe-view__canvas" />
        <div v-if="lastDetectedCountry" class="globe-view__hit-debug">
            <span v-if="lastDetectedCity && lastDetectedCountry"
                >{{ lastDetectedCity.name }}, {{ lastDetectedCountry.countryName }}</span
            >
            <span v-else>{{ lastDetectedCountry.countryName }}</span>
        </div>
        <MemoryModal />
        <AppLoader v-if="!isEarthReady" label="Mapping your world…" />
    </div>
</template>

<script setup vapor lang="ts">
import { ref, useTemplateRef } from 'vue';

import { useGlobeCityLayer } from '@/modules/Globe/composables/useGlobeCityLayer';
import { useGlobeCityMarkers } from '@/modules/Globe/composables/useGlobeCityMarkers';
import { useGlobeCurrentLocationMarker } from '@/modules/Globe/composables/useGlobeCurrentLocationMarker';
import { useGlobeRaycaster } from '@/modules/Globe/composables/useGlobeRaycaster';
import { useGlobeScene } from '@/modules/Globe/composables/useGlobeScene';
import { createGeoLookup, type GeoLookupHandle } from '@/modules/Globe/services/GeoLookup';
import type { DetectedCountry } from '@/modules/Globe/types/globe.types';
import MemoryModal from '@/modules/Memory/components/MemoryModal.vue';
import { useMemoryModal } from '@/modules/Memory/composables/useMemoryModal';
import AppLoader from '@/shared/components/AppLoader.vue';
import type { City } from '@/shared/types/city.types';

const canvasRef = useTemplateRef<HTMLCanvasElement>('canvasRef');

const { globeSceneHandle, isEarthReady } = useGlobeScene(canvasRef);
const memoryModal = useMemoryModal();
const { cachedCities } = useGlobeCityLayer(globeSceneHandle);
const { getIntersectedCity } = useGlobeCityMarkers(globeSceneHandle, cachedCities, canvasRef);
useGlobeCurrentLocationMarker(globeSceneHandle);

const lastDetectedCountry = ref<DetectedCountry | null>(null);
const lastDetectedCity = ref<City | null>(null);

let geoLookupHandle: GeoLookupHandle | null = null;
createGeoLookup('110m')
    .then((handle) => {
        geoLookupHandle = handle;
    })
    .catch((error) => {
        console.error('[Globe] Failed to load geo lookup', error);
    });

const { raycaster } = useGlobeRaycaster(
    canvasRef,
    globeSceneHandle,
    (hit) => {
        const detectedCountry = geoLookupHandle?.detectCountry(hit.lat, hit.lng) ?? null;
        // Only look for a city when a country was found, and only when the click
        // lands directly on a visible city label sprite (exact hit test).
        const detectedCity = detectedCountry ? getIntersectedCity(raycaster) : null;

        lastDetectedCountry.value = detectedCountry;
        lastDetectedCity.value = detectedCity;

        if (detectedCountry) {
            console.log(
                `[Globe] ${detectedCity ? `${detectedCity.name}, ` : ''}${detectedCountry.countryName} ` +
                    `(${hit.lat.toFixed(2)}\u00b0, ${hit.lng.toFixed(2)}\u00b0)`,
            );

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
                memoryModal.openAtCountry(detectedCountry.countryCode, detectedCountry.countryName, hit.lat, hit.lng);
            }
        } else {
            console.log(`[Globe] Ocean (${hit.lat.toFixed(2)}\u00b0, ${hit.lng.toFixed(2)}\u00b0)`);
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
}
</style>
