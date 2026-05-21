import { onBeforeUnmount, onMounted, shallowRef, type Ref } from 'vue';

import { loadCityCatalog, type CitiesDataset } from '@/modules/Globe/services/CityCatalog';
import type { GlobeSceneHandle } from '@/modules/Globe/types/globe.types';
import type { City } from '@/shared/types/city.types';

/**
 * Loads the bundled GeoNames city catalog from `/public/cities` once and
 * exposes the parsed `City[]` to downstream consumers (e.g. the marker
 * layer in `useGlobeCityMarkers`).
 *
 * The previous implementation streamed tiles from the GeoNames web API.
 * Memory Atlas is meant to feel like a self-contained product, so we ship
 * the dataset locally and load all 33k cities once on mount.
 *
 * The `_globeSceneHandleRef` argument is kept for API stability with the
 * existing GlobeView wiring; it is intentionally unused.
 */

const DEFAULT_DATASET: CitiesDataset = 'cities15000';

export function useGlobeCityLayer(_globeSceneHandleRef: Readonly<Ref<GlobeSceneHandle | null>>) {
    void _globeSceneHandleRef;

    const cachedCities = shallowRef<readonly City[]>([]);
    let isUnmounted = false;

    onMounted(() => {
        loadCityCatalog(DEFAULT_DATASET)
            .then((cities) => {
                if (isUnmounted) return;
                // Sort by population descending so LOD slicing in
                // useGlobeCityMarkers shows the most significant cities first.
                const sortedByPopulation = [...cities].sort(
                    (a, b) => (b.population ?? 0) - (a.population ?? 0),
                );
                cachedCities.value = sortedByPopulation;
            })
            .catch((error: unknown) => {
                console.error('[CityLayer] Failed to load city catalog', error);
            });
    });

    onBeforeUnmount(() => {
        isUnmounted = true;
    });

    /**
     * Linear haversine scan. O(n) over 33k is sub-millisecond and only runs on
     * click — no spatial index needed.
     */
    function findNearestCity(lat: number, lng: number, maxDistanceKm = 50): City | null {
        const cities = cachedCities.value;
        if (cities.length === 0) return null;

        const earthRadiusKm = 6371;
        const targetLatRad = (lat * Math.PI) / 180;
        const targetLngRad = (lng * Math.PI) / 180;

        let bestCity: City | null = null;
        let bestDistance = Infinity;

        for (const city of cities) {
            const cityLatRad = (city.lat * Math.PI) / 180;
            const cityLngRad = (city.lng * Math.PI) / 180;
            const deltaLat = cityLatRad - targetLatRad;
            const deltaLng = cityLngRad - targetLngRad;
            const haversine =
                Math.sin(deltaLat / 2) ** 2 +
                Math.cos(targetLatRad) * Math.cos(cityLatRad) * Math.sin(deltaLng / 2) ** 2;
            const distanceKm = 2 * earthRadiusKm * Math.asin(Math.min(1, Math.sqrt(haversine)));
            if (distanceKm < bestDistance) {
                bestDistance = distanceKm;
                bestCity = city;
            }
        }

        return bestDistance <= maxDistanceKm ? bestCity : null;
    }

    return {
        cachedCities,
        findNearestCity,
    };
}
