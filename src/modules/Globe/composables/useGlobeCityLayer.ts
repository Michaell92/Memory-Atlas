import { PerspectiveCamera } from 'three';
import { onBeforeUnmount, onMounted, shallowRef, type Ref } from 'vue';

import { createCityLookup, type CityLookupHandle } from '@/modules/Globe/services/CityLookup';
import type { GlobeSceneHandle } from '@/modules/Globe/types/globe.types';
import type { City } from '@/shared/types/city.types';

/**
 * Wires the CityLookup service to the Vue component lifecycle and the live
 * camera position.
 *
 * How it works
 * ─────────────
 * 1. A 200 ms interval reads the camera position each tick.
 * 2. If the camera has moved beyond a hysteresis threshold the interval resets
 *    a 700 ms "settle" timer — identical to a debounce on camera movement.
 * 3. When the timer fires (camera is stationary) it calls
 *    `ensureCitiesForViewport`, which fetches any uncached tiles and resolves.
 * 4. After resolution, `cachedCities` is updated so downstream consumers
 *    (e.g. an InstancedMesh marker layer) can react.
 *
 * The composable is intentionally passive: it does not own a render loop or
 * modify the Three.js scene directly. City markers should be built separately
 * by reading `cachedCities`.
 *
 * Graceful degradation
 * ─────────────────────
 * If `VITE_GEONAMES_USERNAME` is not set the composable logs a warning and
 * returns an empty cities list. Country-level features continue to work.
 */

const CAMERA_POLL_INTERVAL_MS = 200;

/**
 * How long the camera must be stationary after a zoom before tiles are fetched.
 * Prevents firing mid-pinch or mid-scroll.
 */
const CAMERA_SETTLE_DELAY_MS = 800;

/**
 * Minimum radius change that counts as a new zoom level and triggers a refresh.
 * Panning and auto-rotation do NOT trigger a refresh — the tile cache handles
 * the geographic coverage problem (tiles fetched once, cached forever).
 */
const MINIMUM_RADIUS_CHANGE = 0.12;

export function useGlobeCityLayer(globeSceneHandleRef: Readonly<Ref<GlobeSceneHandle | null>>) {
    const cachedCities = shallowRef<readonly City[]>([]);

    let cityLookupHandle: CityLookupHandle | null = null;
    let pollIntervalId: ReturnType<typeof setInterval> | null = null;
    let settleTimerId: ReturnType<typeof setTimeout> | null = null;

    // Camera radius at the last fetch trigger — used to detect zoom-level changes.
    // Position (lat/lng) is intentionally NOT tracked: auto-rotation and panning
    // do not trigger re-fetches. The tile cache ensures cities persist across pans.
    let lastTriggeredRadius = NaN;

    // ── Camera geo-position ─────────────────────────────────────────────────

    function computeCameraGeoPosition(camera: PerspectiveCamera): {
        centerLat: number;
        centerLng: number;
        cameraRadius: number;
    } {
        const cameraRadius = camera.position.length();
        // Normalise the camera position vector to the unit sphere surface point
        // directly beneath the camera — this is the centre of the visible cap.
        const normalizedX = camera.position.x / cameraRadius;
        const normalizedY = camera.position.y / cameraRadius;
        const normalizedZ = camera.position.z / cameraRadius;

        // World-space inverse of latLngTo3D (which accounts for globe.rotation.y = -π/2):
        //   x_world = cos(lat)*sin(lng)  →  lng = atan2(x, z)
        //   z_world = cos(lat)*cos(lng)
        //   y_world = sin(lat)           →  lat = asin(y)
        //
        // The old formula atan2(-z, x) was the LOCAL-space inverse and produced
        // a ~90° systematic error: the initial camera (world +Z = Greenwich)
        // returned lng=−90° (Americas), fetching cities from the wrong hemisphere.
        const centerLat = Math.asin(Math.max(-1, Math.min(1, normalizedY))) * (180 / Math.PI);
        const centerLng = Math.atan2(normalizedX, normalizedZ) * (180 / Math.PI);

        return { centerLat, centerLng, cameraRadius };
    }

    // ── Viewport refresh ────────────────────────────────────────────────────

    function refreshCitiesForCurrentViewport(centerLat: number, centerLng: number, cameraRadius: number): void {
        if (!cityLookupHandle) return;

        cityLookupHandle
            .ensureCitiesForViewport(centerLat, centerLng, cameraRadius)
            .then(() => {
                cachedCities.value = cityLookupHandle!.getCachedCities();
            })
            .catch((error: unknown) => {
                console.error('[CityLayer] Failed to fetch cities for viewport', error);
            });
    }

    // ── Camera poll loop ────────────────────────────────────────────────────

    function pollCameraPosition(): void {
        const camera = globeSceneHandleRef.value?.camera;
        if (!camera) return;

        const { centerLat, centerLng, cameraRadius } = computeCameraGeoPosition(camera);

        // Only trigger on initial load or when the user zooms (radius changes).
        // Auto-rotation and panning do NOT trigger a refresh — this is intentional.
        // The tile cache ensures already-fetched cities remain visible across pans.
        const isInitialLoad = isNaN(lastTriggeredRadius);
        const zoomLevelChanged = !isInitialLoad && Math.abs(cameraRadius - lastTriggeredRadius) > MINIMUM_RADIUS_CHANGE;

        if (!isInitialLoad && !zoomLevelChanged) return;

        lastTriggeredRadius = cameraRadius;

        // Debounce: wait for zooming to finish before firing the fetch.
        if (settleTimerId !== null) clearTimeout(settleTimerId);
        settleTimerId = setTimeout(() => {
            settleTimerId = null;
            refreshCitiesForCurrentViewport(centerLat, centerLng, cameraRadius);
        }, CAMERA_SETTLE_DELAY_MS);
    }

    // ── Lifecycle ───────────────────────────────────────────────────────────

    onMounted(() => {
        const geonamesUsername = import.meta.env.VITE_GEONAMES_USERNAME as string | undefined;

        if (!geonamesUsername) {
            console.warn(
                '[CityLayer] VITE_GEONAMES_USERNAME is not set — city detection is disabled. ' +
                    'Register at https://www.geonames.org/login and add the username to your .env file.',
            );
            return;
        }

        try {
            cityLookupHandle = createCityLookup(geonamesUsername);
        } catch (error) {
            console.error('[CityLayer] Failed to create city lookup handle', error);
            return;
        }

        pollIntervalId = setInterval(pollCameraPosition, CAMERA_POLL_INTERVAL_MS);
    });

    onBeforeUnmount(() => {
        if (pollIntervalId !== null) clearInterval(pollIntervalId);
        if (settleTimerId !== null) clearTimeout(settleTimerId);
    });

    // ── Public API ──────────────────────────────────────────────────────────

    /**
     * Returns the nearest city from the cache within `maxDistanceKm`, or
     * `null` if none is close enough or no cities have been loaded yet.
     * Intended to be called inside the raycaster `onHit` callback.
     */
    function findNearestCity(lat: number, lng: number, maxDistanceKm?: number): City | null {
        return cityLookupHandle?.findNearestCity(lat, lng, maxDistanceKm) ?? null;
    }

    return {
        /** Reactive list of all cities currently held in the tile cache. */
        cachedCities,
        findNearestCity,
    };
}
