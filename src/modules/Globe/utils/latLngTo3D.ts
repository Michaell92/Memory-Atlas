import { Vector3 } from 'three';

/**
 * Converts geodetic coordinates to a 3D point in **world space** on (or above)
 * the globe surface.
 *
 * The globe mesh has `rotation.y = -Math.PI / 2`, which transforms its local
 * space to world space via R_y(−π/2). The local-space formula is the standard
 * spherical-to-Cartesian; this function applies that rotation so markers placed
 * directly into the scene sit exactly on top of the visible texture:
 *
 *   World space (what Three.js uses for scene objects):
 *     lat=0, lng=0   → +Z  (Greenwich equator — initial camera faces +Z)
 *     lat=0, lng=90  → +X
 *     lat=0, lng=−90 → −X
 *     lat=90         → +Y  (north pole)
 *
 *   Local space (what the raycaster and UV mapping use, before mesh rotation):
 *     lat=0, lng=0   → +X
 *     lat=0, lng=90  → −Z
 *
 * @param lat  Latitude in degrees  [−90, 90]
 * @param lng  Longitude in degrees [−180, 180]
 * @param radius  Distance from origin — use 1 for the globe surface, slightly
 *                more (e.g. 1.004) to float a marker just above it.
 */
export function latLngTo3D(lat: number, lng: number, radius: number = 1): Vector3 {
    const latRad = lat * (Math.PI / 180);
    const lngRad = lng * (Math.PI / 180);
    // World-space formula = R_y(−π/2) applied to the local-space spherical result:
    //   local  → world: x_w = cos(lat)*sin(lng),  z_w = cos(lat)*cos(lng)
    return new Vector3(
        radius * Math.cos(latRad) * Math.sin(lngRad),
        radius * Math.sin(latRad),
        radius * Math.cos(latRad) * Math.cos(lngRad),
    );
}
