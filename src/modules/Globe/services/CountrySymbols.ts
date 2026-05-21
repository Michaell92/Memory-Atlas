import { Group, Sprite, SpriteMaterial } from 'three';
import { geoCentroid } from 'd3-geo';
import { feature } from 'topojson-client';
import type { GeometryCollection } from 'topojson-specification';
import type { Feature, FeatureCollection, Geometry } from 'geojson';

import { COUNTRY_SYMBOL_MAP, createSymbolTexture } from '@/modules/Globe/utils/countrySymbols';
import { latLngTo3D } from '@/modules/Globe/utils/latLngTo3D';
import { loadTopology } from '@/modules/Globe/services/TopoLoader';
import type { CountrySymbolsHandle, CountrySymbolsOptions } from '@/modules/Globe/types/globe.types';

/**
 * Loads world-atlas topojson and creates a Three.js Sprite for every country
 * that has an entry in COUNTRY_SYMBOL_MAP.
 *
 * Each sprite is a camera-facing billboard sitting slightly above the globe
 * surface at the country's geographic centroid. Because sprites are 3D
 * geometry rather than texture pixels, they render at native display
 * resolution — perfectly sharp at any zoom level.
 *
 * Sprites use depthTest=true so they are correctly occluded by the globe when
 * their country is on the back hemisphere.
 */
export async function createCountrySymbols(options: CountrySymbolsOptions = {}): Promise<CountrySymbolsHandle> {
    const { globeRadius = 1, resolution = '50m', spriteWorldSize = 0.04, symbolCanvasSize = 256 } = options;

    const topology = await loadTopology(resolution);
    const countriesObject = topology.objects['countries'] as GeometryCollection;
    const countriesFeatureCollection = feature(topology, countriesObject) as unknown as FeatureCollection<Geometry>;

    // Sprites float slightly above the surface so they don't z-fight the globe.
    const surfaceOffset = globeRadius * 1.015;

    const group = new Group();
    group.name = 'CountrySymbols';

    // Collect textures so we can dispose them all on cleanup.
    const allocatedTextures: ReturnType<typeof createSymbolTexture>[] = [];

    for (const countryFeature of countriesFeatureCollection.features as Feature<Geometry>[]) {
        const numericId = String(countryFeature.id);
        const symbolType = COUNTRY_SYMBOL_MAP[numericId];
        if (!symbolType) continue;

        // geoCentroid returns [longitude, latitude] in GeoJSON convention.
        const [centroidLng, centroidLat] = geoCentroid(countryFeature);

        const symbolTexture = createSymbolTexture(symbolType, symbolCanvasSize);
        allocatedTextures.push(symbolTexture);

        const spriteMaterial = new SpriteMaterial({
            map: symbolTexture,
            transparent: true,
            depthTest: true,
            depthWrite: false,
            // Sprites are additive-ish — a gentle alpha blend keeps them from
            // looking pasted-on against the globe colors.
            opacity: 0.92,
        });

        const sprite = new Sprite(spriteMaterial);
        sprite.scale.set(spriteWorldSize * globeRadius, spriteWorldSize * globeRadius, 1);
        sprite.position.copy(latLngTo3D(centroidLat, centroidLng, surfaceOffset));
        group.add(sprite);
    }

    return {
        object: group,
        dispose: () => {
            for (const symbolTexture of allocatedTextures) {
                symbolTexture.dispose();
            }
            for (const sprite of group.children as Sprite[]) {
                (sprite.material as SpriteMaterial).dispose();
            }
            group.clear();
        },
    };
}
