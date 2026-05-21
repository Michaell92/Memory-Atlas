import type { City } from '@/shared/types/city.types';

/**
 * Dynamic city lookup backed by the GeoNames `citiesJSON` API.
 *
 * Why dynamic instead of a bundled 15k-city JSON?
 * ──────────────────────────────────────────────────
 * This is the same pattern Google Maps uses:
 *
 *   1. Divide the world into a tile grid at several "zoom levels".
 *   2. Map the camera radius to a zoom level — farther out = larger tiles
 *      = only major cities returned per tile (natural LOD).
 *   3. Fetch only the tiles that overlap the current viewport.
 *   4. Cache every fetched tile forever — re-entering an area is instant.
 *
 * At r ≥ 3.5 (most of the globe visible) we issue a single world request
 * and get the top capitals/mega-cities. As the user zooms in the tiles
 * shrink and more local cities appear — without ever loading all 250k+
 * GeoNames cities up front.
 *
 * Registration
 * ─────────────
 * GeoNames requires a free account. Register at https://www.geonames.org/login
 * then set VITE_GEONAMES_USERNAME in your .env file.
 * Free tier: 30 000 API credits/day, 2 000/hour. More than enough for a
 * personal travel app.
 *
 * Country codes
 * ─────────────
 * GeoNames returns ISO 3166-1 alpha-2 codes (e.g. "FR", "PL"). City.countryCode
 * therefore holds alpha-2, distinct from the numeric codes used by GeoLookup /
 * world-atlas for country detection.
 */

// ─── GeoNames API types ──────────────────────────────────────────────────────

interface GeoNamesRawCity {
    geonameId: number;
    name: string;
    toponymName: string;
    lat: string;
    lng: string;
    countrycode: string;
    population: number;
}

interface GeoNamesResponse {
    geonames?: GeoNamesRawCity[];
    status?: { message: string; value: number };
}

// ─── Zoom-level configuration ────────────────────────────────────────────────

/**
 * Controls how cities are fetched per camera distance (globe radius = 1).
 *
 * Ordered from farthest to closest — first entry where
 * `cameraRadius >= minCameraRadius` wins.
 *
 * `tileSizeDeg: null` → issue a single global bounding-box request instead of
 * tiling (only used for the zoomed-out world view).
 */
interface ZoomLevelConfig {
    minCameraRadius: number;
    tileSizeDeg: number | null;
    maxRows: number;
}

const ZOOM_LEVEL_CONFIGS: readonly ZoomLevelConfig[] = [
    { minCameraRadius: 3.5, tileSizeDeg: null, maxRows: 150 }, // world overview — 1 request
    { minCameraRadius: 2.5, tileSizeDeg: 60, maxRows: 50 }, // continental
    { minCameraRadius: 2.0, tileSizeDeg: 30, maxRows: 50 }, // regional
    { minCameraRadius: 1.7, tileSizeDeg: 15, maxRows: 80 }, // country-level
    { minCameraRadius: 0, tileSizeDeg: 7, maxRows: 100 }, // city-level (zoomed in close)
] as const;

const GEONAMES_BASE_URL = 'https://secure.geonames.org/citiesJSON';

/** Tile cache key used for the world overview (no tiling). */
const WORLD_TILE_KEY = 'world';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function resolveZoomLevelConfig(cameraRadius: number): ZoomLevelConfig {
    for (const config of ZOOM_LEVEL_CONFIGS) {
        if (cameraRadius >= config.minCameraRadius) return config;
    }
    // Fallback — should never be reached given minCameraRadius: 0 entry.
    return ZOOM_LEVEL_CONFIGS[ZOOM_LEVEL_CONFIGS.length - 1]!;
}

/**
 * Half-angle in degrees of the spherical cap visible from a camera at the
 * given distance from a unit globe (radius = 1).
 */
function computeVisibleHalfAngleDeg(cameraRadius: number): number {
    // acos(1/r) — clamped to [0,1] domain for safety if r is near 1.
    return Math.acos(Math.min(1, 1 / cameraRadius)) * (180 / Math.PI);
}

/**
 * Snaps a coordinate to the lower bucket boundary for the given bucket size.
 * Used to build stable viewport cache keys — minor camera drift stays in the
 * same bucket and does not trigger a new fetch.
 */
function snapToBucket(value: number, bucketSizeDeg: number): number {
    return Math.floor(value / bucketSizeDeg) * bucketSizeDeg;
}

export function haversineDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const earthRadiusKm = 6371;
    const deltaLat = (lat2 - lat1) * (Math.PI / 180);
    const deltaLng = (lng2 - lng1) * (Math.PI / 180);
    const sinHalfDeltaLat = Math.sin(deltaLat / 2);
    const sinHalfDeltaLng = Math.sin(deltaLng / 2);
    const haversineA =
        sinHalfDeltaLat * sinHalfDeltaLat +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * sinHalfDeltaLng * sinHalfDeltaLng;
    return earthRadiusKm * 2 * Math.atan2(Math.sqrt(haversineA), Math.sqrt(1 - haversineA));
}

// ─── Public API ──────────────────────────────────────────────────────────────

export interface CityLookupHandle {
    /**
     * Ensures cities covering the viewport are present in the cache.
     * Resolves when all pending tile requests for this viewport have settled.
     * Safe to call on every camera-settle event — already-cached tiles are skipped.
     */
    ensureCitiesForViewport(centerLat: number, centerLng: number, cameraRadius: number): Promise<void>;

    /**
     * Returns the nearest cached city within `maxDistanceKm` of the given
     * lat/lng, or `null` if no city is close enough.
     * Call after `ensureCitiesForViewport` resolves for best results.
     */
    findNearestCity(lat: number, lng: number, maxDistanceKm?: number): City | null;

    /**
     * All unique cities currently held in the tile cache.
     * Suitable for building an InstancedMesh marker layer.
     */
    getCachedCities(): readonly City[];
}

export function createCityLookup(geonamesUsername: string): CityLookupHandle {
    if (!geonamesUsername) {
        throw new Error(
            'CityLookup requires a GeoNames username. ' +
                'Register for free at https://www.geonames.org/login ' +
                'then add VITE_GEONAMES_USERNAME=<your_username> to your .env file.',
        );
    }

    // Tile cache: key → cities in that tile.
    const tileCache = new Map<string, City[]>();

    // In-flight map: deduplicates concurrent requests for the same tile key.
    const inflightRequests = new Map<string, Promise<void>>();

    // Failed tile cooldown: a tile that errored won't be retried for 60 seconds.
    // Without this, a transient GeoNames error (e.g. account not yet activated)
    // causes an infinite retry storm on every viewport refresh.
    const failedTileTimestamps = new Map<string, number>();
    const FAILED_TILE_COOLDOWN_MS = 60_000;

    // ── Fetching ────────────────────────────────────────────────────────────

    async function fetchCitiesForBBox(
        north: number,
        south: number,
        east: number,
        west: number,
        maxRows: number,
    ): Promise<City[]> {
        const urlSearchParams = new URLSearchParams({
            north: String(north),
            south: String(south),
            east: String(east),
            west: String(west),
            lang: 'en',
            username: geonamesUsername,
            maxRows: String(maxRows),
        });

        const response = await fetch(`${GEONAMES_BASE_URL}?${urlSearchParams.toString()}`);
        if (!response.ok) {
            throw new Error(`GeoNames request failed with status ${response.status}`);
        }

        const data = (await response.json()) as GeoNamesResponse;

        if (data.status) {
            throw new Error(`GeoNames API error ${data.status.value}: ${data.status.message}`);
        }

        return (data.geonames ?? []).map(
            (rawCity): City => ({
                id: String(rawCity.geonameId),
                name: rawCity.name,
                countryCode: rawCity.countrycode, // ISO 3166-1 alpha-2 (e.g. "FR")
                countryName: '', // Not returned by citiesJSON; resolved separately if needed
                lat: parseFloat(rawCity.lat),
                lng: parseFloat(rawCity.lng),
            }),
        );
    }

    async function fetchAndCacheTile(
        tileKey: string,
        north: number,
        south: number,
        east: number,
        west: number,
        maxRows: number,
    ): Promise<void> {
        try {
            const cities = await fetchCitiesForBBox(north, south, east, west, maxRows);
            tileCache.set(tileKey, cities);
            failedTileTimestamps.delete(tileKey); // clear any previous failure on success
        } catch (error) {
            failedTileTimestamps.set(tileKey, Date.now()); // record failure time
            throw error;
        } finally {
            inflightRequests.delete(tileKey);
        }
    }

    function ensureTileFetched(
        tileKey: string,
        north: number,
        south: number,
        east: number,
        west: number,
        maxRows: number,
    ): Promise<void> {
        if (tileCache.has(tileKey)) return Promise.resolve();

        // Skip tiles that failed recently — prevents retry storms.
        const lastFailureTime = failedTileTimestamps.get(tileKey);
        if (lastFailureTime !== undefined && Date.now() - lastFailureTime < FAILED_TILE_COOLDOWN_MS) {
            return Promise.resolve();
        }

        const existingInflight = inflightRequests.get(tileKey);
        if (existingInflight) return existingInflight;

        const fetchPromise = fetchAndCacheTile(tileKey, north, south, east, west, maxRows);
        inflightRequests.set(tileKey, fetchPromise);
        return fetchPromise;
    }

    // ── Viewport resolution ─────────────────────────────────────────────────

    async function ensureCitiesForViewport(centerLat: number, centerLng: number, cameraRadius: number): Promise<void> {
        const config = resolveZoomLevelConfig(cameraRadius);
        const tierIndex = ZOOM_LEVEL_CONFIGS.indexOf(config as ZoomLevelConfig);

        // World overview: single global request covering everything.
        if (config.tileSizeDeg === null) {
            await ensureTileFetched(WORLD_TILE_KEY, 90, -90, 180, -180, config.maxRows);
            return;
        }

        // All other zoom levels: ONE request covering the full visible spherical cap.
        //
        // Why not tile-based? On a globe the camera always sees a spherical cap.
        // At city zoom (tileSizeDeg=7°) the visible half-angle is ~48°, which
        // would generate a 14×14 tile grid (~196 requests). A single bounding-box
        // request to GeoNames already returns the top-N cities by population for
        // the exact area we care about — no tiling needed.
        //
        // The cache key uses bucketed lat/lng (bucket = tileSizeDeg) so that minor
        // camera jitter does not produce unique keys and trigger redundant fetches.
        const bucketSizeDeg = config.tileSizeDeg;
        const bucketedLat = snapToBucket(centerLat, bucketSizeDeg);
        const bucketedLng = snapToBucket(centerLng, bucketSizeDeg);
        const viewportKey = `v${tierIndex}_${bucketedLat}_${bucketedLng}`;

        const visibleHalfAngleDeg = computeVisibleHalfAngleDeg(cameraRadius);
        const bboxNorth = Math.min(90, centerLat + visibleHalfAngleDeg);
        const bboxSouth = Math.max(-90, centerLat - visibleHalfAngleDeg);
        const bboxEast = Math.min(180, centerLng + visibleHalfAngleDeg);
        const bboxWest = Math.max(-180, centerLng - visibleHalfAngleDeg);

        await ensureTileFetched(viewportKey, bboxNorth, bboxSouth, bboxEast, bboxWest, config.maxRows);
    }

    // ── Query ───────────────────────────────────────────────────────────────

    function findNearestCity(lat: number, lng: number, maxDistanceKm: number = 300): City | null {
        let nearestCity: City | null = null;
        let nearestDistanceKm = maxDistanceKm;

        for (const cachedCities of tileCache.values()) {
            for (const city of cachedCities) {
                const distanceKm = haversineDistanceKm(lat, lng, city.lat, city.lng);
                if (distanceKm < nearestDistanceKm) {
                    nearestDistanceKm = distanceKm;
                    nearestCity = city;
                }
            }
        }

        return nearestCity;
    }

    function getCachedCities(): readonly City[] {
        const allCities: City[] = [];
        const seenCityIds = new Set<string>();

        for (const cachedCities of tileCache.values()) {
            for (const city of cachedCities) {
                if (!seenCityIds.has(city.id)) {
                    seenCityIds.add(city.id);
                    allCities.push(city);
                }
            }
        }

        return allCities;
    }

    return {
        ensureCitiesForViewport,
        findNearestCity,
        getCachedCities,
    };
}
