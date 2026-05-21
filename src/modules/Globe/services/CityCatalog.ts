import type { City } from '@/shared/types/city.types';

/**
 * Loads and parses a GeoNames TSV city dump bundled in /public/cities.
 *
 * GeoNames cities files come from https://download.geonames.org/export/dump/
 * and follow a stable tab-separated layout. We parse it once on first request
 * and cache the resulting `City[]` in memory.
 *
 * Column layout (0-indexed):
 *   0  geonameid
 *   1  name
 *   2  asciiname
 *   3  alternatenames
 *   4  latitude
 *   5  longitude
 *   6  feature class
 *   7  feature code
 *   8  country code (ISO-3166 alpha-2)
 *   14 population
 *
 * Trade-offs
 * ----------
 *  - cities15000.txt is ~33k entries / 8MB raw — comfortable to keep fully in
 *    memory after parsing (~3MB of plain JS objects).
 *  - cities5000.txt is ~69k entries / 15MB — choose this when LOD demands it.
 *
 * The fetch is cached as a Promise so concurrent callers share a single load.
 */

export type CitiesDataset = 'cities15000' | 'cities5000';

const datasetPromiseCache = new Map<CitiesDataset, Promise<City[]>>();

/**
 * Parse a single GeoNames TSV line. Returns null if the line is malformed or
 * coordinates are non-numeric (defensive — the official dump is clean but we
 * never want a bad row to break catalog loading).
 */
function parseCityLine(rawLine: string): City | null {
    if (rawLine.length === 0) return null;
    const columns = rawLine.split('\t');
    if (columns.length < 15) return null;

    const geonameId = columns[0]!;
    const asciiName = columns[2]!;
    const latitude = Number(columns[4]);
    const longitude = Number(columns[5]);
    const countryCode = columns[8]!;
    const population = Number(columns[14] ?? '0');

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    if (geonameId.length === 0 || asciiName.length === 0) return null;

    return {
        id: geonameId,
        name: asciiName,
        countryCode,
        // GeoNames doesn't ship country names in city dumps — leave blank;
        // consumers that need it should join with the country topology.
        countryName: '',
        lat: latitude,
        lng: longitude,
        population: Number.isFinite(population) ? population : 0,
    };
}

export function loadCityCatalog(dataset: CitiesDataset = 'cities15000'): Promise<City[]> {
    const cached = datasetPromiseCache.get(dataset);
    if (cached) return cached;

    const promise = fetch(`/cities/${dataset}.txt`)
        .then((response) => {
            if (!response.ok) {
                throw new Error(`CityCatalog: ${dataset} fetch failed (${response.status})`);
            }
            return response.text();
        })
        .then((rawText) => {
            // Single split per file — lighter on GC than streaming line-by-line
            // for files this size, and the parse runs in well under a frame.
            const lines = rawText.split('\n');
            const cities: City[] = [];
            for (const line of lines) {
                const parsed = parseCityLine(line);
                if (parsed) cities.push(parsed);
            }
            return cities;
        });

    datasetPromiseCache.set(dataset, promise);
    return promise;
}
