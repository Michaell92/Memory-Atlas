import { geoContains } from 'd3-geo';
import { feature } from 'topojson-client';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import type { GeometryCollection, Topology } from 'topojson-specification';

import type { DetectedCountry } from '@/modules/Globe/types/globe.types';

/**
 * Loads world-atlas topology and exposes geographic lookups against it.
 *
 * Why a service (not a composable):
 *   - The topology is a heavy network resource (hundreds of KB to MBs).
 *   - It is a static fact about the world, not Vue lifecycle state.
 *   - Sharing one promise across all callers ensures the topology is fetched
 *     exactly once even if multiple composables request it.
 */

interface CountryFeatureProperties {
    name: string;
}

type CountryFeature = Feature<Geometry, CountryFeatureProperties> & { id?: string | number };

const TOPOLOGY_URL_BY_RESOLUTION = {
    '110m': 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json',
    '50m': 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json',
    '10m': 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-10m.json',
} as const;

type TopologyResolution = keyof typeof TOPOLOGY_URL_BY_RESOLUTION;

let cachedFeaturesPromise: Promise<CountryFeature[]> | null = null;

async function loadCountryFeatures(resolution: TopologyResolution): Promise<CountryFeature[]> {
    if (cachedFeaturesPromise) return cachedFeaturesPromise;

    cachedFeaturesPromise = (async () => {
        const topology = (await fetch(TOPOLOGY_URL_BY_RESOLUTION[resolution]).then((response) =>
            response.json(),
        )) as Topology;
        const countriesObject = topology.objects['countries'] as GeometryCollection;
        const featureCollection = feature(topology, countriesObject) as unknown as FeatureCollection<
            Geometry,
            CountryFeatureProperties
        >;
        return featureCollection.features as CountryFeature[];
    })();

    return cachedFeaturesPromise;
}

export interface GeoLookupHandle {
    /** Resolve a (lat, lng) point to the country containing it, or `null` over ocean. */
    detectCountry: (lat: number, lng: number) => DetectedCountry | null;
    /** True once the topology has finished loading. */
    isReady: () => boolean;
}

export async function createGeoLookup(resolution: TopologyResolution = '110m'): Promise<GeoLookupHandle> {
    const features = await loadCountryFeatures(resolution);
    let ready = true;

    function detectCountry(lat: number, lng: number): DetectedCountry | null {
        if (!ready) return null;
        // d3-geo expects [longitude, latitude] in degrees.
        const point: [number, number] = [lng, lat];
        for (const countryFeature of features) {
            if (geoContains(countryFeature, point)) {
                const idValue = countryFeature.id;
                const countryCode = idValue === undefined || idValue === null ? '' : String(idValue);
                return {
                    countryCode,
                    countryName: countryFeature.properties?.name ?? 'Unknown',
                };
            }
        }
        return null;
    }

    return {
        detectCountry,
        isReady: () => ready,
    };
}
