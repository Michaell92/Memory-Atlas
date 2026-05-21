import { Matrix4, Raycaster, Vector2 } from 'three';
import { onBeforeUnmount, onMounted, type Ref } from 'vue';

import type { GlobeHitResult, GlobeSceneHandle } from '@/modules/Globe/types/globe.types';

/**
 * Wires a click-based raycaster to the globe canvas.
 *
 * On each click the composable:
 *   1. Converts the pointer position to NDC (Normalized Device Coordinates).
 *   2. Casts a ray from the camera through the pointer.
 *   3. Checks for intersection with the globe mesh.
 *   4. If hit — transforms the world-space point into the globe's local object
 *      space (undoing any mesh rotation) and computes geodetic lat / lng.
 *   5. Calls `onHit` with the result; calls `onMiss` if the click landed off
 *      the globe (useful for closing open panels, etc.).
 *
 * Lat/Lng math
 * ─────────────
 * Three.js `SphereGeometry` (default phi/theta) places vertices such that on
 * the equator:
 *
 *   u = 0.00  →  local −X   (texture seam, lng ±180°)
 *   u = 0.25  →  local +Z   (lng −90°)
 *   u = 0.50  →  local +X   (lng 0°, Greenwich)
 *   u = 0.75  →  local −Z   (lng +90°)
 *
 * After normalising the local hit point we therefore use:
 *
 *   lat = asin(y)                          — y from −1 (south) to +1 (north)
 *   lng = atan2(−z, x) × (180 / π)         — gives [−180, 180] aligned with
 *                                            the equirectangular texture
 *
 * Using `matrixWorldInverse` means the globe mesh's `rotation.y` offset is
 * handled transparently — the formula stays valid even if the mesh is rotated.
 */
export function useGlobeRaycaster(
    canvasRef: Readonly<Ref<HTMLCanvasElement | null>>,
    globeSceneHandleRef: Readonly<Ref<GlobeSceneHandle | null>>,
    onHit: (result: GlobeHitResult) => void,
    onMiss?: () => void,
) {
    const raycaster = new Raycaster();
    const pointerNdc = new Vector2();

    // Track pointer-down position so we can ignore drag-releases (globe spins).
    // A release that moved more than DRAG_THRESHOLD_PX pixels is a drag, not a click.
    const DRAG_THRESHOLD_PX = 5;
    let pointerDownX = 0;
    let pointerDownY = 0;

    function handlePointerDown(event: PointerEvent): void {
        pointerDownX = event.clientX;
        pointerDownY = event.clientY;
    }

    function handlePointerUp(event: PointerEvent): void {
        const dx = event.clientX - pointerDownX;
        const dy = event.clientY - pointerDownY;
        if (Math.sqrt(dx * dx + dy * dy) > DRAG_THRESHOLD_PX) return;

        const canvas = canvasRef.value;
        const globeSceneHandle = globeSceneHandleRef.value;
        if (!canvas || !globeSceneHandle) return;

        // Convert pointer position to NDC: x ∈ [−1, 1], y ∈ [−1, 1].
        const { left, top, width, height } = canvas.getBoundingClientRect();
        pointerNdc.set(((event.clientX - left) / width) * 2 - 1, -((event.clientY - top) / height) * 2 + 1);

        raycaster.setFromCamera(pointerNdc, globeSceneHandle.camera);
        const intersections = raycaster.intersectObject(globeSceneHandle.globe, false);

        const firstIntersection = intersections[0];
        if (!firstIntersection) {
            onMiss?.();
            return;
        }

        const worldHitPoint = firstIntersection.point;

        // Transform the world-space hit point into the globe mesh's local object
        // space so the lat/lng formula works regardless of mesh rotation.
        // Note: matrixWorldInverse only exists on Camera in Three.js; for a Mesh
        // we must invert matrixWorld ourselves.
        const globeWorldMatrixInverse = new Matrix4().copy(globeSceneHandle.globe.matrixWorld).invert();
        const localHitPoint = worldHitPoint.clone().applyMatrix4(globeWorldMatrixInverse);
        localHitPoint.normalize();

        // Clamp y before asin to guard against floating-point values ±1.0000001.
        const lat = Math.asin(Math.max(-1, Math.min(1, localHitPoint.y))) * (180 / Math.PI);

        // atan2(−z, x) maps directly to [−180, 180] aligned with the
        // equirectangular texture: +X = Greenwich (0°), +Z = −90°, −X = ±180°.
        const lng = Math.atan2(-localHitPoint.z, localHitPoint.x) * (180 / Math.PI);

        onHit({ lat, lng, point: worldHitPoint });
    }

    onMounted(() => {
        const canvas = canvasRef.value;
        if (!canvas) return;
        canvas.addEventListener('pointerdown', handlePointerDown);
        canvas.addEventListener('pointerup', handlePointerUp);
    });

    onBeforeUnmount(() => {
        const canvas = canvasRef.value;
        if (!canvas) return;
        canvas.removeEventListener('pointerdown', handlePointerDown);
        canvas.removeEventListener('pointerup', handlePointerUp);
    });
}
