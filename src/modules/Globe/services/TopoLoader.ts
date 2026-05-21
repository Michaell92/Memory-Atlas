import type { Topology } from 'topojson-specification';

/**
 * Module-level promise cache keyed by CDN URL.
 *
 * The first caller for a given resolution triggers the fetch; every subsequent
 * caller (even from a different service) gets the exact same Promise back. This
 * means the network request fires once and `JSON.parse` runs once regardless of
 * how many services call `loadTopology` concurrently.
 */
const topologyPromiseCache = new Map<string, Promise<Topology>>();

export function loadTopology(resolution: '110m' | '50m' | '10m'): Promise<Topology> {
    const url = `https://cdn.jsdelivr.net/npm/world-atlas@2/countries-${resolution}.json`;

    if (!topologyPromiseCache.has(url)) {
        topologyPromiseCache.set(
            url,
            fetch(url).then((response) => response.json() as Promise<Topology>),
        );
    }

    return topologyPromiseCache.get(url)!;
}
