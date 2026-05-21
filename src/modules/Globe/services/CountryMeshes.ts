import {
    BufferGeometry,
    Color,
    Float32BufferAttribute,
    Group,
    Mesh,
    MeshStandardMaterial,
    Uint32BufferAttribute,
    Vector3,
} from 'three';
import earcut from 'earcut';
import { feature } from 'topojson-client';
import type { GeometryCollection } from 'topojson-specification';
import type { Feature, FeatureCollection, Polygon, MultiPolygon } from 'geojson';

import { loadTopology } from '@/modules/Globe/services/TopoLoader';
import type { CountryMeshesHandle, CountryMeshesOptions } from '@/modules/Globe/types/globe.types';

/**
 * Build the globe surface as real 3D country meshes — not a stretched canvas.
 *
 * Why this approach
 * -----------------
 * A canvas texture wrapped on a sphere is fundamentally a fixed-resolution
 * raster: zoom in 5× and you see the pixels. Country meshes are vector
 * geometry — triangles in world space — so they stay crisp at any zoom.
 *
 * Pipeline per country
 * --------------------
 *  1. Walk every polygon ring (outer + holes).
 *  2. Densify long edges (split anything > 1° into sub-segments) so triangles
 *     follow the sphere curvature instead of cutting straight chords through
 *     the planet at low latitudes.
 *  3. Triangulate the densified ring set in lng/lat (2D) with earcut — fast,
 *     handles holes via the standard earcut hole-index protocol.
 *  4. Project every densified vertex onto the sphere (lat,lng → x,y,z) and
 *     write into a single shared BufferGeometry per country.
 *
 * Output
 * ------
 * Returns a Group containing one Mesh per country. Each mesh carries
 * `userData.countryCode` and `userData.countryName` so click → memory works
 * with raycasting straight against this Group.
 *
 * Performance
 * -----------
 * `world-atlas` 50m has ~250 countries with ~50k total vertices. After
 * densification we sit around ~150k vertices total — well within budget for
 * a single-frame build. We construct geometry synchronously; the heavy lift
 * is one-shot at scene init.
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

const DEG_TO_RAD = Math.PI / 180;
const LARGE_POLYGON_LONGITUDE_SPAN_DEGREES = 40;
const LARGE_POLYGON_LATITUDE_SPAN_DEGREES = 20;
const STEINER_GRID_STEP_DEGREES = 6;

/**
 * Triangles with any 3-D edge longer than this (world units) are split during
 * sphere subdivision.  At globe radius ~1.0, 0.02 ≈ 1.15° arc — fine enough
 * to stay flush with the ocean sphere at the closest camera zoom level.
 */
const SUBDIVISION_MAX_EDGE_LENGTH = 0.02;

/** Tiny deterministic PRNG so palette assignment is stable. */
function createSeededRandom(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let temporaryState = state;
        temporaryState = Math.imul(temporaryState ^ (temporaryState >>> 15), temporaryState | 1);
        temporaryState ^= temporaryState + Math.imul(temporaryState ^ (temporaryState >>> 7), temporaryState | 61);
        return ((temporaryState ^ (temporaryState >>> 14)) >>> 0) / 4294967296;
    };
}

/**
 * Project lat/lng (degrees) to a point on a sphere of given radius.
 * World-space convention used elsewhere in the project:
 *   x = r·cos(lat)·sin(lng)
 *   y = r·sin(lat)
 *   z = r·cos(lat)·cos(lng)
 */
function projectLatLngToSphere(
    longitudeDegrees: number,
    latitudeDegrees: number,
    sphereRadius: number,
): [number, number, number] {
    const latitudeRadians = latitudeDegrees * DEG_TO_RAD;
    const longitudeRadians = longitudeDegrees * DEG_TO_RAD;
    const cosineLatitude = Math.cos(latitudeRadians);
    return [
        sphereRadius * cosineLatitude * Math.sin(longitudeRadians),
        sphereRadius * Math.sin(latitudeRadians),
        sphereRadius * cosineLatitude * Math.cos(longitudeRadians),
    ];
}

/**
 * Computes the signed area of a 2-D [lng, lat] ring using the shoelace formula.
 * Positive → CCW (GeoJSON exterior convention); negative → CW (hole convention).
 */
function computeSignedArea(ring: number[][]): number {
    let area = 0;
    const ringLength = ring.length;
    for (let pointIndex = 0; pointIndex < ringLength; pointIndex++) {
        const currentPoint = ring[pointIndex]!;
        const nextPoint = ring[(pointIndex + 1) % ringLength]!;
        area += currentPoint[0]! * nextPoint[1]!;
        area -= nextPoint[0]! * currentPoint[1]!;
    }
    return area * 0.5;
}

/**
 * Rewrites a ring so consecutive longitude steps follow the shortest path
 * across the antimeridian instead of jumping from +179° to -179° (or vice
 * versa). earcut operates in flat 2-D space, so leaving those seam jumps in
 * place makes some countries appear to span nearly the whole map and produces
 * the giant pole-facing caps visible in the screenshots.
 */
function unwrapRingLongitudes(ring: number[][]): number[][] {
    if (ring.length === 0) return [];

    const unwrapped: number[][] = [[ring[0]![0]!, ring[0]![1]!]];
    let previousLongitude = ring[0]![0]!;

    for (let pointIndex = 1; pointIndex < ring.length; pointIndex++) {
        const point = ring[pointIndex]!;
        let longitude = point[0]!;
        const latitude = point[1]!;

        while (longitude - previousLongitude > 180) {
            longitude -= 360;
        }
        while (longitude - previousLongitude < -180) {
            longitude += 360;
        }

        unwrapped.push([longitude, latitude]);
        previousLongitude = longitude;
    }

    return unwrapped;
}

/**
 * Densify a ring of [lng, lat] coordinates by splitting any edge longer than
 * `maxEdgeDegrees` into sub-segments. Crucial near the equator where a single
 * polygon edge can span 30°+ — without densification those edges become
 * straight chords cutting through the sphere instead of riding the surface.
 *
 * Returns the densified ring (input coordinates included, plus interpolated
 * intermediate points) without closing it (last point != first).
 */
function densifyRing(ring: number[][], maxEdgeDegrees: number): number[][] {
    const unwrappedRing = unwrapRingLongitudes(ring);
    const densified: number[][] = [];
    const ringLength = unwrappedRing.length;

    for (let pointIndex = 0; pointIndex < ringLength - 1; pointIndex++) {
        const startPoint = unwrappedRing[pointIndex]!;
        const endPoint = unwrappedRing[pointIndex + 1]!;
        const startLongitude = startPoint[0]!;
        const startLatitude = startPoint[1]!;
        const endLongitude = endPoint[0]!;
        const endLatitude = endPoint[1]!;

        densified.push([startLongitude, startLatitude]);

        const longitudeDelta = endLongitude - startLongitude;
        const latitudeDelta = endLatitude - startLatitude;
        const edgeLengthDegrees = Math.hypot(longitudeDelta, latitudeDelta);

        if (edgeLengthDegrees > maxEdgeDegrees) {
            const subdivisionCount = Math.ceil(edgeLengthDegrees / maxEdgeDegrees);
            for (let subdivisionIndex = 1; subdivisionIndex < subdivisionCount; subdivisionIndex++) {
                const interpolation = subdivisionIndex / subdivisionCount;
                densified.push([
                    startLongitude + longitudeDelta * interpolation,
                    startLatitude + latitudeDelta * interpolation,
                ]);
            }
        }
    }
    // Don't repeat the closing point — earcut treats the ring as cyclic.
    return densified;
}

function projectLatLngToUnitVector(longitudeDegrees: number, latitudeDegrees: number): Vector3 {
    const latitudeRadians = latitudeDegrees * DEG_TO_RAD;
    const longitudeRadians = longitudeDegrees * DEG_TO_RAD;
    const cosineLatitude = Math.cos(latitudeRadians);

    return new Vector3(
        cosineLatitude * Math.sin(longitudeRadians),
        Math.sin(latitudeRadians),
        cosineLatitude * Math.cos(longitudeRadians),
    );
}

function buildLocalProjectionBasis(rings: number[][][]): {
    projectionCenter: Vector3;
    projectionEast: Vector3;
    projectionNorth: Vector3;
} {
    const exteriorRing = rings[0] ?? [];
    const averagedCenter = new Vector3();

    for (const point of exteriorRing) {
        averagedCenter.add(projectLatLngToUnitVector(point[0]!, point[1]!));
    }

    if (averagedCenter.lengthSq() < 1e-8) {
        averagedCenter.set(0, 0, 1);
    } else {
        averagedCenter.normalize();
    }

    const worldUp = Math.abs(averagedCenter.y) > 0.9 ? new Vector3(1, 0, 0) : new Vector3(0, 1, 0);
    const projectionEast = new Vector3().crossVectors(worldUp, averagedCenter).normalize();
    const projectionNorth = new Vector3().crossVectors(averagedCenter, projectionEast).normalize();

    return {
        projectionCenter: averagedCenter,
        projectionEast,
        projectionNorth,
    };
}

function projectLatLngToLocalPlane(
    longitudeDegrees: number,
    latitudeDegrees: number,
    projectionCenter: Vector3,
    projectionEast: Vector3,
    projectionNorth: Vector3,
): [number, number] {
    const pointVector = projectLatLngToUnitVector(longitudeDegrees, latitudeDegrees);
    const centerDot = Math.max(pointVector.dot(projectionCenter), 0.0001);

    // Gnomonic projection on the polygon's local tangent plane. Large countries
    // triangulate much more reliably here than in raw lng/lat because the
    // straight 2-D diagonals now correspond to the local viewing plane instead
    // of spanning a highly distorted equirectangular map.
    return [pointVector.dot(projectionEast) / centerDot, pointVector.dot(projectionNorth) / centerDot];
}

function pointInRing(longitude: number, latitude: number, ring: number[][]): boolean {
    let isInside = false;
    for (
        let currentIndex = 0, previousIndex = ring.length - 1;
        currentIndex < ring.length;
        previousIndex = currentIndex++
    ) {
        const currentPoint = ring[currentIndex]!;
        const previousPoint = ring[previousIndex]!;
        const currentLongitude = currentPoint[0]!;
        const currentLatitude = currentPoint[1]!;
        const previousLongitude = previousPoint[0]!;
        const previousLatitude = previousPoint[1]!;

        const crossesLatitudeBand = currentLatitude > latitude !== previousLatitude > latitude;
        if (!crossesLatitudeBand) continue;

        const intersectionLongitude =
            ((previousLongitude - currentLongitude) * (latitude - currentLatitude)) /
                (previousLatitude - currentLatitude) +
            currentLongitude;

        if (longitude < intersectionLongitude) {
            isInside = !isInside;
        }
    }

    return isInside;
}

function pointInPolygon(longitude: number, latitude: number, rings: number[][][]): boolean {
    if (rings.length === 0) return false;
    if (!pointInRing(longitude, latitude, rings[0]!)) return false;

    for (let ringIndex = 1; ringIndex < rings.length; ringIndex++) {
        if (pointInRing(longitude, latitude, rings[ringIndex]!)) return false;
    }

    return true;
}

function buildInteriorSteinerPoints(rings: number[][][]): number[][] {
    const exteriorRing = rings[0];
    if (!exteriorRing || exteriorRing.length === 0) return [];

    let minLongitude = Infinity;
    let maxLongitude = -Infinity;
    let minLatitude = Infinity;
    let maxLatitude = -Infinity;

    for (const point of exteriorRing) {
        minLongitude = Math.min(minLongitude, point[0]!);
        maxLongitude = Math.max(maxLongitude, point[0]!);
        minLatitude = Math.min(minLatitude, point[1]!);
        maxLatitude = Math.max(maxLatitude, point[1]!);
    }

    const longitudeSpan = maxLongitude - minLongitude;
    const latitudeSpan = maxLatitude - minLatitude;
    if (longitudeSpan < LARGE_POLYGON_LONGITUDE_SPAN_DEGREES && latitudeSpan < LARGE_POLYGON_LATITUDE_SPAN_DEGREES) {
        return [];
    }

    const steinerPoints: number[][] = [];
    for (
        let latitude = minLatitude + STEINER_GRID_STEP_DEGREES;
        latitude < maxLatitude;
        latitude += STEINER_GRID_STEP_DEGREES
    ) {
        for (
            let longitude = minLongitude + STEINER_GRID_STEP_DEGREES;
            longitude < maxLongitude;
            longitude += STEINER_GRID_STEP_DEGREES
        ) {
            if (pointInPolygon(longitude, latitude, rings)) {
                steinerPoints.push([longitude, latitude]);
            }
        }
    }

    return steinerPoints;
}

/**
 * Build geometry for one polygon (outer ring + optional holes). Returns null
 * if the polygon is degenerate.
 */
function buildPolygonGeometry(
    rings: number[][][],
    sphereRadius: number,
    maxEdgeDegrees: number,
): { positions: Float32Array; indices: Uint32Array } | null {
    // Densify each ring independently — outer + every hole — then normalise
    // winding order. GeoJSON exterior rings must be CCW (positive signed area)
    // and holes must be CW (negative area). Without this, earcut can produce
    // inward-facing triangles that Three.js's DoubleSide shader lights wrongly
    // (the GLSL flips vNormal for back-face fragments, inverting the day/night
    // computation on roughly half of world-atlas countries).
    const densifiedRings = rings.map((ring, ringIndex) => {
        const densified = densifyRing(ring, maxEdgeDegrees);
        const signedArea = computeSignedArea(densified);
        const isExterior = ringIndex === 0;
        // Exterior should be CCW (area > 0); holes should be CW (area < 0).
        if (isExterior && signedArea < 0) densified.reverse();
        if (!isExterior && signedArea > 0) densified.reverse();
        return densified;
    });
    const interiorSteinerPoints = buildInteriorSteinerPoints(densifiedRings);
    const { projectionCenter, projectionEast, projectionNorth } = buildLocalProjectionBasis(densifiedRings);

    // Flatten into earcut's expected layout: [x0,y0, x1,y1, ...] with
    // holeIndices marking where each hole starts (in vertex units).
    const flatVertices: number[] = [];
    const flatTriangulationVertices: number[] = [];
    const holeIndices: number[] = [];
    let cumulativeVertexCount = 0;

    for (let ringIndex = 0; ringIndex < densifiedRings.length; ringIndex++) {
        const ring = densifiedRings[ringIndex]!;
        if (ringIndex > 0) {
            holeIndices.push(cumulativeVertexCount);
        }
        for (const point of ring) {
            flatVertices.push(point[0]!, point[1]!);
            const [projectedX, projectedY] = projectLatLngToLocalPlane(
                point[0]!,
                point[1]!,
                projectionCenter,
                projectionEast,
                projectionNorth,
            );
            flatTriangulationVertices.push(projectedX, projectedY);
        }
        cumulativeVertexCount += ring.length;
    }

    // earcut accepts a 1-vertex hole as a Steiner point. Large high-latitude
    // polygons like Russia otherwise produce huge valid-in-2D diagonals that
    // turn into visibly wrong wedges on the sphere.
    for (const steinerPoint of interiorSteinerPoints) {
        holeIndices.push(cumulativeVertexCount);
        flatVertices.push(steinerPoint[0]!, steinerPoint[1]!);
        const [projectedX, projectedY] = projectLatLngToLocalPlane(
            steinerPoint[0]!,
            steinerPoint[1]!,
            projectionCenter,
            projectionEast,
            projectionNorth,
        );
        flatTriangulationVertices.push(projectedX, projectedY);
        cumulativeVertexCount += 1;
    }

    if (flatVertices.length < 6) return null; // need ≥3 points

    const triangleIndices = earcut(flatTriangulationVertices, holeIndices, 2);
    if (triangleIndices.length === 0) return null;

    // Project all 2D vertices onto the sphere in 3D.
    const vertexCount = flatVertices.length / 2;
    const positions = new Float32Array(vertexCount * 3);
    for (let vertexIndex = 0; vertexIndex < vertexCount; vertexIndex++) {
        const longitude = flatVertices[vertexIndex * 2]!;
        const latitude = flatVertices[vertexIndex * 2 + 1]!;
        const [worldX, worldY, worldZ] = projectLatLngToSphere(longitude, latitude, sphereRadius);
        positions[vertexIndex * 3] = worldX;
        positions[vertexIndex * 3 + 1] = worldY;
        positions[vertexIndex * 3 + 2] = worldZ;
    }

    return { positions, indices: new Uint32Array(triangleIndices) };
}

/**
 * Merge multiple {positions, indices} chunks into a single pair, offsetting
 * indices so each chunk references its own vertex range.
 */
function mergeGeometryChunks(chunks: Array<{ positions: Float32Array; indices: Uint32Array }>): {
    positions: Float32Array;
    indices: Uint32Array;
} {
    let totalVertexFloats = 0;
    let totalIndexCount = 0;
    for (const chunk of chunks) {
        totalVertexFloats += chunk.positions.length;
        totalIndexCount += chunk.indices.length;
    }

    const positions = new Float32Array(totalVertexFloats);
    const indices = new Uint32Array(totalIndexCount);
    let vertexWriteOffset = 0;
    let indexWriteOffset = 0;

    for (const chunk of chunks) {
        positions.set(chunk.positions, vertexWriteOffset);
        const baseVertexIndex = vertexWriteOffset / 3;
        for (let indexInChunk = 0; indexInChunk < chunk.indices.length; indexInChunk++) {
            indices[indexWriteOffset + indexInChunk] = chunk.indices[indexInChunk]! + baseVertexIndex;
        }
        vertexWriteOffset += chunk.positions.length;
        indexWriteOffset += chunk.indices.length;
    }

    return { positions, indices };
}

/**
 * Subdivides a triangulated sphere mesh so every triangle's longest 3-D edge
 * is ≤ `maxEdgeLength`.  New vertices at edge midpoints are projected back onto
 * the sphere, keeping ALL fragments on the surface — not just ring boundaries.
 *
 * WHY THIS IS NEEDED
 * ------------------
 * earcut triangulates in 2-D lat/lng space.  The resulting flat 3-D triangles
 * are chords, not arcs.  For a triangle spanning 10°, the chord midpoint sits
 * ~1.5% below the sphere surface.  At close zoom (camera radius 1.05) those
 * below-surface interiors lose the depth test against the ocean sphere and the
 * ocean shows through — the "black holes" that widen as you zoom in.
 * polygonOffset only adjusts depth values, not the 3-D vertex positions, so it
 * cannot fix this alone.  Subdivision forces every fragment to lie on (or
 * above) the ocean sphere so the depth test always passes.
 *
 * IMPLEMENTATION
 * --------------
 * 1→4 split: create a midpoint on each of the three edges and push four
 * sub-triangles onto the processing stack.  The midpoint cache ensures that
 * when two adjacent triangles share an edge, both look up the same vertex —
 * no T-junctions within a single country mesh.
 */
function subdivideToSphere(
    positions: Float32Array,
    indices: Uint32Array,
    sphereRadius: number,
    maxEdgeLength: number,
): { positions: Float32Array; indices: Uint32Array } {
    const maxEdgeLengthSquared = maxEdgeLength * maxEdgeLength;

    // Dynamic list — new midpoint vertices are appended here as they are created.
    const positionList: number[] = Array.from(positions);

    // Maps a symmetry-invariant edge key → the midpoint vertex index already
    // created for that edge.  Keeps adjacent triangles sharing an edge consistent.
    const midpointIndexByEdge = new Map<number, number>();

    function getOrCreateMidpointVertex(indexA: number, indexB: number): number {
        // Encode the unordered vertex pair into one integer.
        // Safe for vertex indices < 2^21 ≈ 2 M — far above any single country mesh size.
        const edgeKey = indexA < indexB ? indexA * 2097152 + indexB : indexB * 2097152 + indexA;

        const cachedIndex = midpointIndexByEdge.get(edgeKey);
        if (cachedIndex !== undefined) return cachedIndex;

        const ax = positionList[indexA * 3]!;
        const ay = positionList[indexA * 3 + 1]!;
        const az = positionList[indexA * 3 + 2]!;
        const bx = positionList[indexB * 3]!;
        const by = positionList[indexB * 3 + 1]!;
        const bz = positionList[indexB * 3 + 2]!;

        const midX = (ax + bx) * 0.5;
        const midY = (ay + by) * 0.5;
        const midZ = (az + bz) * 0.5;

        // Project the linear midpoint onto the sphere so it lies on the surface.
        const midpointLength = Math.hypot(midX, midY, midZ);
        const projectionScale = sphereRadius / midpointLength;

        const newVertexIndex = positionList.length / 3;
        positionList.push(midX * projectionScale, midY * projectionScale, midZ * projectionScale);
        midpointIndexByEdge.set(edgeKey, newVertexIndex);
        return newVertexIndex;
    }

    // Iterative stack — avoids JS call-stack limits on deeply subdivided meshes.
    const outputTriangleIndices: number[] = [];
    const processingStack: [number, number, number][] = [];

    for (let triangleStart = 0; triangleStart < indices.length; triangleStart += 3) {
        processingStack.push([indices[triangleStart]!, indices[triangleStart + 1]!, indices[triangleStart + 2]!]);
    }

    while (processingStack.length > 0) {
        const [i0, i1, i2] = processingStack.pop()!;

        const x0 = positionList[i0 * 3]!;
        const y0 = positionList[i0 * 3 + 1]!;
        const z0 = positionList[i0 * 3 + 2]!;
        const x1 = positionList[i1 * 3]!;
        const y1 = positionList[i1 * 3 + 1]!;
        const z1 = positionList[i1 * 3 + 2]!;
        const x2 = positionList[i2 * 3]!;
        const y2 = positionList[i2 * 3 + 1]!;
        const z2 = positionList[i2 * 3 + 2]!;

        const edge01Squared = (x1 - x0) ** 2 + (y1 - y0) ** 2 + (z1 - z0) ** 2;
        const edge12Squared = (x2 - x1) ** 2 + (y2 - y1) ** 2 + (z2 - z1) ** 2;
        const edge20Squared = (x0 - x2) ** 2 + (y0 - y2) ** 2 + (z0 - z2) ** 2;

        if (
            edge01Squared <= maxEdgeLengthSquared &&
            edge12Squared <= maxEdgeLengthSquared &&
            edge20Squared <= maxEdgeLengthSquared
        ) {
            // All edges fit within budget — emit triangle unchanged.
            outputTriangleIndices.push(i0, i1, i2);
            continue;
        }

        // Split all three edges and push four sub-triangles for re-evaluation.
        const midpoint01 = getOrCreateMidpointVertex(i0, i1);
        const midpoint12 = getOrCreateMidpointVertex(i1, i2);
        const midpoint20 = getOrCreateMidpointVertex(i2, i0);

        processingStack.push(
            [i0, midpoint01, midpoint20],
            [midpoint01, i1, midpoint12],
            [midpoint20, midpoint12, i2],
            [midpoint01, midpoint12, midpoint20],
        );
    }

    return {
        positions: new Float32Array(positionList),
        indices: new Uint32Array(outputTriangleIndices),
    };
}

export async function createCountryMeshes(options: CountryMeshesOptions = {}): Promise<CountryMeshesHandle> {
    const {
        globeRadius = 1,
        resolution = '50m',
        palette = DEFAULT_PALETTE,
        paletteSeed = 1,
        maxEdgeDegrees = 1.0,
        // Lift slightly above radius so meshes don't z-fight a base sphere if one exists.
        surfaceOffset = 1.0005,
    } = options;

    const topology = await loadTopology(resolution);
    const countriesObject = topology.objects['countries'] as GeometryCollection;
    const countriesFeatureCollection = feature(topology, countriesObject) as unknown as FeatureCollection<
        Polygon | MultiPolygon,
        { name: string }
    >;

    const renderRadius = globeRadius * surfaceOffset;
    const random = createSeededRandom(paletteSeed);
    const group = new Group();
    group.name = 'CountryMeshes';

    const allMaterials: MeshStandardMaterial[] = [];
    const allGeometries: BufferGeometry[] = [];

    for (const countryFeature of countriesFeatureCollection.features as Feature<
        Polygon | MultiPolygon,
        { name: string }
    >[]) {
        const geometry = countryFeature.geometry;
        if (!geometry) continue;

        // Collect every polygon (a country may be Polygon or MultiPolygon).
        const polygons: number[][][][] =
            geometry.type === 'Polygon'
                ? [geometry.coordinates as number[][][]]
                : (geometry.coordinates as number[][][][]);

        const geometryChunks: Array<{ positions: Float32Array; indices: Uint32Array }> = [];
        for (const polygon of polygons) {
            const chunk = buildPolygonGeometry(polygon, renderRadius, maxEdgeDegrees);
            if (chunk) geometryChunks.push(chunk);
        }
        if (geometryChunks.length === 0) continue;

        const merged = mergeGeometryChunks(geometryChunks);

        // Subdivide flat earcut triangles onto the sphere surface.  Without this,
        // large interior triangles (chords spanning 5°–30°) dip below the ocean
        // sphere, losing the depth test and showing as black holes at close zoom.
        const subdivided = subdivideToSphere(
            merged.positions,
            merged.indices,
            renderRadius,
            SUBDIVISION_MAX_EDGE_LENGTH,
        );

        const bufferGeometry = new BufferGeometry();
        bufferGeometry.setAttribute('position', new Float32BufferAttribute(subdivided.positions, 3));
        bufferGeometry.setIndex(new Uint32BufferAttribute(subdivided.indices, 1));

        // Each vertex lies on a sphere centred at origin — its outward normal
        // is just normalize(position). Using this instead of computed face
        // normals makes the day/night terminator shader match the ocean
        // sphere's natural lighting exactly.
        const sphereNormals = new Float32Array(subdivided.positions.length);
        for (let positionIndex = 0; positionIndex < subdivided.positions.length; positionIndex += 3) {
            const positionX = subdivided.positions[positionIndex]!;
            const positionY = subdivided.positions[positionIndex + 1]!;
            const positionZ = subdivided.positions[positionIndex + 2]!;
            const inverseLength = 1 / Math.hypot(positionX, positionY, positionZ);
            sphereNormals[positionIndex] = positionX * inverseLength;
            sphereNormals[positionIndex + 1] = positionY * inverseLength;
            sphereNormals[positionIndex + 2] = positionZ * inverseLength;
        }
        bufferGeometry.setAttribute('normal', new Float32BufferAttribute(sphereNormals, 3));

        const colorIndex = Math.floor(random() * palette.length);
        const fillColorHex = palette[colorIndex] ?? palette[0]!;
        const fillColor = new Color(fillColorHex);
        const material = new MeshStandardMaterial({
            color: fillColor,
            // Emissive matches fill color but is gated to the night side by the
            // shader patch below — keeps land readable in shadow without washing
            // out the day side.
            emissive: fillColor,
            emissiveIntensity: 0.35,
            roughness: 0.9,
            metalness: 0.0,
            // polygonOffset shifts fragments toward the camera in clip space,
            // accounting for triangle slope. This is the correct fix for z-fighting
            // between the country meshes and the ocean sphere: a world-space
            // surfaceOffset shrinks to near-zero at glancing viewing angles (most
            // of the visible hemisphere), while polygonOffset compensates for slope
            // automatically.
            polygonOffset: true,
            polygonOffsetFactor: -2,
            polygonOffsetUnits: -4,
        });
        material.onBeforeCompile = (shader) => {
            shader.fragmentShader = shader.fragmentShader.replace(
                'vec3 totalEmissiveRadiance = emissive;',
                `vec3 totalEmissiveRadiance = emissive;
        #if NUM_DIR_LIGHTS > 0
            float sunFacing = dot(normalize(vNormal), directionalLights[0].direction);
            float nightEmissiveFactor = 1.0 - smoothstep(0.0, 1.3, sunFacing);
            totalEmissiveRadiance *= nightEmissiveFactor;
        #endif`,
            );
        };

        const mesh = new Mesh(bufferGeometry, material);
        mesh.userData = {
            countryCode: String(countryFeature.id ?? ''),
            countryName: countryFeature.properties?.name ?? '',
        };
        mesh.name = `Country:${mesh.userData['countryName']}`;

        group.add(mesh);
        allMaterials.push(material);
        allGeometries.push(bufferGeometry);
    }

    return {
        object: group,
        dispose: () => {
            for (const geometry of allGeometries) geometry.dispose();
            for (const material of allMaterials) material.dispose();
        },
    };
}
