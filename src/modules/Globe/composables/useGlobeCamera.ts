import { MathUtils, Spherical, Vector2, Vector3, type PerspectiveCamera } from 'three';
import { onBeforeUnmount } from 'vue';

import type { CameraControllerHandle, CameraControllerOptions } from '@/modules/Globe/types/globe.types';

/**
 * Custom inertia camera controller — built for cinematic feel, not GIS precision.
 *
 * Why not Three's `OrbitControls`?
 *   - OrbitControls is great, but it's tuned for CAD: linear, immediate, snappy.
 *   - This controller integrates angular velocity with frame-rate-independent
 *     exponential damping, so the globe keeps spinning briefly after the user
 *     lets go and decays smoothly. Feels like mass.
 *   - GSAP camera moves can write directly to the `spherical` state alongside
 *     user input — we can interrupt a fly-to with a drag, or hand control
 *     back to inertia mid-tween.
 *
 * Coordinate model: spherical (radius, polar=phi, azimuth=theta) around `target`.
 *   - phi: 0 at +Y north pole, π at -Y south pole; clamped to avoid gimbal flip.
 *   - theta: rotation around +Y; unbounded (wraps freely).
 *   - radius: zoom distance from target.
 */
export function useGlobeCamera(
    camera: PerspectiveCamera,
    domElement: HTMLElement,
    options: CameraControllerOptions = {},
): CameraControllerHandle {
    const {
        initialRadius = 3.2,
        minRadius = 1.05,
        maxRadius = 8,
        initialPhi = Math.PI / 2,
        minPhi = 0.15,
        maxPhi = Math.PI - 0.15,
        rotateSpeed = 0.005,
        zoomSpeed = 0.0015,
        damping = 4.5,
        autoRotateSpeed = 0.03,
    } = options;

    const spherical = new Spherical(initialRadius, initialPhi, 0);
    const target = new Vector3(0, 0, 0);

    // Angular velocity (rad/sec) and radial velocity (units/sec).
    const angularVelocity = { theta: 0, phi: 0, radius: 0 };

    let autoRotateEnabled = true;
    let isDragging = false;
    let activePointerId: number | null = null;
    const lastPointerPosition = new Vector2();

    // Pinch-to-zoom tracking.
    const trackedPointers = new Map<number, Vector2>();
    let lastPinchDistance = 0;

    function applyToCamera() {
        const cameraPosition = new Vector3().setFromSpherical(spherical).add(target);
        camera.position.copy(cameraPosition);
        camera.lookAt(target);
    }

    function onPointerDown(event: PointerEvent) {
        domElement.setPointerCapture(event.pointerId);
        trackedPointers.set(event.pointerId, new Vector2(event.clientX, event.clientY));

        if (trackedPointers.size === 1) {
            isDragging = true;
            activePointerId = event.pointerId;
            lastPointerPosition.set(event.clientX, event.clientY);
            autoRotateEnabled = false;
            // Kill residual inertia on grab — feels more deliberate.
            angularVelocity.theta = 0;
            angularVelocity.phi = 0;
        } else if (trackedPointers.size === 2) {
            isDragging = false;
            const positions = Array.from(trackedPointers.values());
            const [firstPointer, secondPointer] = positions;
            if (firstPointer && secondPointer) {
                lastPinchDistance = firstPointer.distanceTo(secondPointer);
            }
        }
    }

    function onPointerMove(event: PointerEvent) {
        const trackedPosition = trackedPointers.get(event.pointerId);
        if (!trackedPosition) return;
        trackedPosition.set(event.clientX, event.clientY);

        if (trackedPointers.size === 2) {
            const positions = Array.from(trackedPointers.values());
            const [firstPointer, secondPointer] = positions;
            if (!firstPointer || !secondPointer) return;
            const pinchDistance = firstPointer.distanceTo(secondPointer);
            const pinchDelta = lastPinchDistance - pinchDistance;
            spherical.radius = MathUtils.clamp(spherical.radius + pinchDelta * zoomSpeed * 4, minRadius, maxRadius);
            lastPinchDistance = pinchDistance;
            return;
        }

        if (!isDragging || event.pointerId !== activePointerId) return;

        const movementX = event.clientX - lastPointerPosition.x;
        const movementY = event.clientY - lastPointerPosition.y;
        lastPointerPosition.set(event.clientX, event.clientY);

        // Drive velocity, not position. Damping later produces the inertia feel.
        angularVelocity.theta = -movementX * rotateSpeed * 60;
        angularVelocity.phi = -movementY * rotateSpeed * 60;
    }

    function onPointerEnd(event: PointerEvent) {
        trackedPointers.delete(event.pointerId);
        if (event.pointerId === activePointerId) {
            isDragging = false;
            activePointerId = null;
        }
        if (trackedPointers.size < 2) lastPinchDistance = 0;
    }

    function onWheel(event: WheelEvent) {
        event.preventDefault();
        autoRotateEnabled = false;
        angularVelocity.radius += event.deltaY * zoomSpeed;
    }

    function onContextMenu(event: MouseEvent) {
        event.preventDefault();
    }

    domElement.addEventListener('pointerdown', onPointerDown);
    domElement.addEventListener('pointermove', onPointerMove);
    domElement.addEventListener('pointerup', onPointerEnd);
    domElement.addEventListener('pointercancel', onPointerEnd);
    domElement.addEventListener('wheel', onWheel, { passive: false });
    domElement.addEventListener('contextmenu', onContextMenu);
    domElement.style.touchAction = 'none';

    applyToCamera();

    function update(deltaSeconds: number) {
        // Frame-rate-independent exponential decay toward zero.
        const dampingFactor = Math.exp(-damping * deltaSeconds);

        if (autoRotateEnabled && !isDragging && Math.abs(angularVelocity.theta) < 0.001) {
            spherical.theta -= autoRotateSpeed * deltaSeconds;
        }

        spherical.theta += angularVelocity.theta * deltaSeconds;
        spherical.phi = MathUtils.clamp(spherical.phi + angularVelocity.phi * deltaSeconds, minPhi, maxPhi);
        spherical.radius = MathUtils.clamp(
            spherical.radius + angularVelocity.radius * deltaSeconds,
            minRadius,
            maxRadius,
        );

        angularVelocity.theta *= dampingFactor;
        angularVelocity.phi *= dampingFactor;
        angularVelocity.radius *= dampingFactor;

        applyToCamera();
    }

    function dispose() {
        domElement.removeEventListener('pointerdown', onPointerDown);
        domElement.removeEventListener('pointermove', onPointerMove);
        domElement.removeEventListener('pointerup', onPointerEnd);
        domElement.removeEventListener('pointercancel', onPointerEnd);
        domElement.removeEventListener('wheel', onWheel);
        domElement.removeEventListener('contextmenu', onContextMenu);
        trackedPointers.clear();
    }

    function setAutoRotate(enabled: boolean) {
        autoRotateEnabled = enabled;
    }

    function flyTo(targetRadius: number, targetTheta: number, targetPhi: number) {
        // Synchronous setter. GSAP-driven tweens write to `spherical.*` directly;
        // this is the imperative escape hatch.
        spherical.radius = MathUtils.clamp(targetRadius, minRadius, maxRadius);
        spherical.theta = targetTheta;
        spherical.phi = MathUtils.clamp(targetPhi, minPhi, maxPhi);
        angularVelocity.theta = 0;
        angularVelocity.phi = 0;
        angularVelocity.radius = 0;
        applyToCamera();
    }

    onBeforeUnmount(dispose);

    return {
        update,
        dispose,
        setAutoRotate,
        flyTo,
        spherical,
        target,
    };
}
