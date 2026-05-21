import { BufferGeometry, Float32BufferAttribute, LineBasicMaterial, LineSegments } from 'three';
import { mesh } from 'topojson-client';
import type { GeometryCollection } from 'topojson-specification';
import type { MultiLineString } from 'geojson';

import { loadTopology } from '@/modules/Globe/services/TopoLoader';
import type { CountryBordersHandle, CountryBordersOptions } from '@/modules/Globe/types/globe.types';

/**
 * Loads world-atlas topojson and converts every country border arc into a
 * Three.js LineSegments object sitting just above the globe surface.
 *
 * Because these are true 3D line primitives, they render at native display
 * resolution regardless of how far the camera is zoomed in — no texture
 * blurring at close range.
 *
 * Note: WebGL restricts LineBasicMaterial.linewidth to 1 on most platforms.
 * This is fine; 1px crisp borders look sharp at all zoom levels.
 */
export async function createCountryBorders(options: CountryBordersOptions = {}): Promise<CountryBordersHandle> {
    const { globeRadius = 1, resolution = '50m', color = '#ffffff', opacity = 0.55 } = options;

    const topology = await loadTopology(resolution);
    const countriesObject = topology.objects['countries'] as GeometryCollection;

    // mesh() without a filter returns all arcs: interior borders + coastlines.
    const bordersMesh = mesh(topology, countriesObject) as MultiLineString;

    // Place lines at globeRadius * 1.002 so they don't z-fight the globe surface.
    const surfaceOffset = globeRadius * 1.002;
    const DEG_TO_RAD = Math.PI / 180;

    // First pass: count total line-segment endpoints so we can pre-allocate one
    // contiguous Float32Array instead of growing a dynamic number[] array.
    // Each segment contributes 2 endpoints × 3 floats = 6 floats.
    let totalEndpoints = 0;
    for (const ring of bordersMesh.coordinates) {
        totalEndpoints += (ring.length - 1) * 2;
    }
    const positions = new Float32Array(totalEndpoints * 3);
    let writeIndex = 0;

    // Second pass: inline the lat/lng → world-space conversion to avoid
    // allocating a Vector3 object per border point (tens of thousands of them).
    //   World-space formula (same as latLngTo3D, unrolled):
    //     x = r · cos(lat) · sin(lng)
    //     y = r · sin(lat)
    //     z = r · cos(lat) · cos(lng)
    for (const ring of bordersMesh.coordinates) {
        for (let segmentIndex = 0; segmentIndex < ring.length - 1; segmentIndex++) {
            const [lng1, lat1] = ring[segmentIndex]!;
            const [lng2, lat2] = ring[segmentIndex + 1]!;

            const latRad1 = lat1 * DEG_TO_RAD;
            const lngRad1 = lng1 * DEG_TO_RAD;
            const cosLat1 = Math.cos(latRad1);
            positions[writeIndex++] = surfaceOffset * cosLat1 * Math.sin(lngRad1);
            positions[writeIndex++] = surfaceOffset * Math.sin(latRad1);
            positions[writeIndex++] = surfaceOffset * cosLat1 * Math.cos(lngRad1);

            const latRad2 = lat2 * DEG_TO_RAD;
            const lngRad2 = lng2 * DEG_TO_RAD;
            const cosLat2 = Math.cos(latRad2);
            positions[writeIndex++] = surfaceOffset * cosLat2 * Math.sin(lngRad2);
            positions[writeIndex++] = surfaceOffset * Math.sin(latRad2);
            positions[writeIndex++] = surfaceOffset * cosLat2 * Math.cos(lngRad2);
        }
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));

    const material = new LineBasicMaterial({
        color,
        transparent: true,
        opacity,
    });

    const lineSegments = new LineSegments(geometry, material);
    lineSegments.name = 'CountryBorders';

    return {
        object: lineSegments,
        dispose: () => {
            geometry.dispose();
            material.dispose();
        },
    };
}
