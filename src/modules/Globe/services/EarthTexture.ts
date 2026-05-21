import { CanvasTexture, LinearFilter, LinearMipmapLinearFilter, RepeatWrapping, SRGBColorSpace } from 'three';
import { geoEquirectangular, geoPath } from 'd3-geo';
import { feature, mesh } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import type { Feature, FeatureCollection, Geometry, MultiLineString } from 'geojson';

import { loadTopology } from '@/modules/Globe/services/TopoLoader';
import type { EarthTextureHandle, EarthTextureOptions } from '@/modules/Globe/types/globe.types';

/**
 * Build a procedural Earth texture from Natural Earth topojson + d3-geo.
 *
 * Strategy:
 *   1. Load `world-atlas` topojson at the requested resolution.
 *   2. Project geometries with an equirectangular projection (lng/lat → x/y),
 *      because that's the projection Three.js's SphereGeometry UVs expect.
 *   3. Paint each country with a deterministic pastel from a seeded palette so
 *      neighbours rarely share a color, and the assignment is stable between
 *      sessions (great for later "visited country" tinting).
 *   4. Stroke crisp borders on top — a single d3 mesh draw, not per-country,
 *      so shared borders never double up.
 *
 * Output is a `CanvasTexture` you plug into `MeshStandardMaterial.map`. The
 * underlying canvas is exposed so future passes (mountains, city icons,
 * "you are here" stamps) can paint overlays without rebuilding the base.
 *
 * Resolution guide:
 *   '110m' — fast, blocky borders, good default for first paint
 *   '50m'  — balanced; what we ship to users
 *   '10m'  — beautiful but ~5 MB, save for desktop / hero shots
 */
const DEFAULT_PALETTE = [
    '#f4d9a1', // sand
    '#f0c2a0', // peach
    '#e8b4a3', // dusty rose
    '#d8c7e8', // lavender
    '#bdd4f0', // sky
    '#a6d8c7', // mint
    '#d0e6b3', // pistachio
    '#f2e6a8', // butter
    '#ecd0b8', // apricot
    '#c9d8b6', // sage
];

/** Tiny deterministic PRNG so the same seed always produces the same map. */
function createSeededRandom(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        // Mulberry32 — short, fast, good distribution for our use.
        state = (state + 0x6d2b79f5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export async function createEarthTexture(options: EarthTextureOptions = {}): Promise<EarthTextureHandle> {
    const {
        width = 4096,
        oceanColor = '#1d3b8a',
        borderColor = '#ffffff',
        borderWidth = 1.5,
        countryPalette = DEFAULT_PALETTE,
        paletteSeed = 1,
        resolution = '110m',
    } = options;

    const height = width / 2; // equirectangular is always 2:1

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) {
        throw new Error('createEarthTexture: 2D canvas context unavailable');
    }

    // ── Load topology ─────────────────────────────────────────────────────
    const topology = await loadTopology(resolution);
    const countriesObject = topology.objects['countries'] as GeometryCollection;
    const countriesFeatureCollection = feature(topology, countriesObject) as unknown as FeatureCollection<Geometry>;
    const bordersMesh = mesh(topology, countriesObject, (a, b) => a !== b) as MultiLineString;

    // ── Projection sized to the canvas ────────────────────────────────────
    // Equirectangular at scale = width / (2π) covers the full 360° around.
    const projection = geoEquirectangular()
        .scale(width / (2 * Math.PI))
        .translate([width / 2, height / 2]);
    const pathRenderer = geoPath(projection, context);

    function drawBaseMap() {
        // Ocean fill.
        context!.fillStyle = oceanColor;
        context!.fillRect(0, 0, width, height);

        // Country fills — seeded so the assignment is reproducible.
        const random = createSeededRandom(paletteSeed);
        for (const countryFeature of countriesFeatureCollection.features as Feature<Geometry>[]) {
            const colorIndex = Math.floor(random() * countryPalette.length);
            context!.fillStyle = countryPalette[colorIndex] ?? countryPalette[0]!;
            context!.beginPath();
            pathRenderer(countryFeature);
            context!.fill();
        }

        // Borders — one mesh draw so shared edges stroke once.
        context!.strokeStyle = borderColor;
        context!.lineWidth = borderWidth;
        context!.lineJoin = 'round';
        context!.beginPath();
        pathRenderer(bordersMesh);
        context!.stroke();
    }

    drawBaseMap();

    // ── Wrap as a Three texture ───────────────────────────────────────────
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.wrapS = RepeatWrapping; // horizontal wrap matches the sphere UV seam
    texture.wrapT = RepeatWrapping;
    texture.magFilter = LinearFilter;
    texture.minFilter = LinearMipmapLinearFilter;
    texture.anisotropy = 8;
    texture.needsUpdate = true;

    return {
        texture,
        canvas,
        redraw: () => {
            drawBaseMap();
            texture.needsUpdate = true;
        },
        dispose: () => {
            texture.dispose();
        },
    };
}
