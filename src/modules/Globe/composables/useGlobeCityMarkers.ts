import { InstancedMesh, Matrix4, MeshBasicMaterial, SphereGeometry, type Material } from 'three';
import { onBeforeUnmount, watch, type Ref } from 'vue';

import { latLngTo3D } from '@/modules/Globe/utils/latLngTo3D';
import type { GlobeSceneHandle } from '@/modules/Globe/types/globe.types';
import type { City } from '@/shared/types/city.types';

/**
 * Renders cached cities as cyan InstancedMesh dots on the globe surface.
 *
 * Design choices:
 *   - InstancedMesh (one draw call regardless of city count) per project rules.
 *   - MeshBasicMaterial — unlit, so dots glow equally on day and night side.
 *     The bloom pass turns the bright cyan into a soft halo automatically.
 *   - frustumCulled = false — tiny markers near the limb flicker when culled
 *     individually; letting Three.js cull the whole mesh is wrong too, so we
 *     disable it. The single draw call cost is negligible.
 *   - Capacity doubles as needed — the mesh is recreated only when the cached
 *     city count exceeds the current buffer size.
 */

/** Globe-space radius at which markers sit — just above the surface. */
const MARKER_SURFACE_RADIUS = 1.004;

/** Visual size of each dot in globe-space units. */
const MARKER_DOT_RADIUS = 0.006;

/** Starting InstancedMesh buffer size. Grows as more tiles are loaded. */
const INITIAL_INSTANCE_CAPACITY = 500;

/** Bright cyan — blooms nicely against the dark ocean. */
const MARKER_COLOR = 0x7ef7c0;

export function useGlobeCityMarkers(
    globeSceneHandleRef: Readonly<Ref<GlobeSceneHandle | null>>,
    cachedCitiesRef: Readonly<Ref<readonly City[]>>,
): void {
    let markerMesh: InstancedMesh | null = null;
    let instanceCapacity = 0;

    // Reused per-instance matrix — avoids allocating one Matrix4 per city per update.
    const instanceMatrix = new Matrix4();

    // ── Mesh lifecycle ──────────────────────────────────────────────────────

    function createMarkerMesh(capacity: number): InstancedMesh {
        const markerGeometry = new SphereGeometry(MARKER_DOT_RADIUS, 6, 6);
        const markerMaterial = new MeshBasicMaterial({ color: MARKER_COLOR });
        const mesh = new InstancedMesh(markerGeometry, markerMaterial, capacity);
        mesh.count = 0;
        mesh.frustumCulled = false;
        return mesh;
    }

    function destroyMarkerMesh(): void {
        if (!markerMesh) return;
        const sceneHandle = globeSceneHandleRef.value;
        if (sceneHandle) sceneHandle.scene.remove(markerMesh);
        markerMesh.geometry.dispose();
        (markerMesh.material as Material).dispose();
        markerMesh = null;
        instanceCapacity = 0;
    }

    // ── Marker update ───────────────────────────────────────────────────────

    function updateMarkers(cities: readonly City[]): void {
        const sceneHandle = globeSceneHandleRef.value;
        if (!sceneHandle) return;

        // Rebuild the mesh if the city count exceeds current buffer capacity.
        if (!markerMesh || cities.length > instanceCapacity) {
            destroyMarkerMesh();
            instanceCapacity = Math.max(INITIAL_INSTANCE_CAPACITY, Math.ceil(cities.length * 1.5));
            markerMesh = createMarkerMesh(instanceCapacity);
            sceneHandle.scene.add(markerMesh);
        }

        for (let cityIndex = 0; cityIndex < cities.length; cityIndex++) {
            const city = cities[cityIndex]!;
            const markerPosition = latLngTo3D(city.lat, city.lng, MARKER_SURFACE_RADIUS);
            instanceMatrix.makeTranslation(markerPosition.x, markerPosition.y, markerPosition.z);
            markerMesh.setMatrixAt(cityIndex, instanceMatrix);
        }

        markerMesh.count = cities.length;
        markerMesh.instanceMatrix.needsUpdate = true;
    }

    // ── Watchers ────────────────────────────────────────────────────────────

    // Update markers whenever the city cache grows.
    watch(cachedCitiesRef, (updatedCities) => {
        updateMarkers(updatedCities);
    });

    // If the scene becomes ready after cities are already loaded, add the mesh.
    watch(globeSceneHandleRef, (newHandle) => {
        if (newHandle && markerMesh) {
            newHandle.scene.add(markerMesh);
        }
    });

    onBeforeUnmount(() => {
        destroyMarkerMesh();
    });
}
