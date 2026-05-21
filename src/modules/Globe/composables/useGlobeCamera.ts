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
        rotateSpeed = 0.01,
        zoomSpeed = 0.0015,
        damping = 4.5,
        autoRotateSpeed = 0.03,
    } = options;

    const spherical = new Spherical(initialRadius, initialPhi, 0);
    const target = new Vector3(0, 0, 0);

    // Angular velocity (rad/sec) and radial velocity (units/sec).
    const angularVelocity = { theta: 0, phi: 0, radius: 0 };

    // Raw desired velocity from pointer input — actual angularVelocity lerps toward
    // this each frame to low-pass-filter hand jitter while keeping intentional drags crisp.
    const targetAngularVelocity = { theta: 0, phi: 0 };

    // Higher = snappier response; lower = more buttery smoothing.
    const inputSmoothing = 14;

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
            targetAngularVelocity.theta = 0;
            targetAngularVelocity.phi = 0;
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

        // Use a much stronger precision curve near the minimum radius.
        // Linear scaling still feels too fast once the user is inspecting one
        // country closely, so we square the normalized near-zoom fraction.
        let zoomScaleFactor = 1;
        if (spherical.radius <= initialRadius) {
            const nearZoomFraction = MathUtils.clamp(
                (spherical.radius - minRadius) / (initialRadius - minRadius),
                0,
                1,
            );
            zoomScaleFactor = 0.045 + 0.955 * nearZoomFraction * nearZoomFraction * nearZoomFraction;
        } else {
            const farZoomFraction = MathUtils.clamp(
                (spherical.radius - initialRadius) / (maxRadius - initialRadius),
                0,
                1,
            );
            zoomScaleFactor = 1 + farZoomFraction * 0.35;
        }

        // At the closest zooms, cap raw drag velocity as well. Otherwise a
        // single large pointer delta can still inject too much angular speed
        // before the precision curve has a chance to help.
        const closeZoomFraction = MathUtils.clamp((spherical.radius - minRadius) / 0.2, 0, 1);
        const angularVelocityCap = 0.45 + closeZoomFraction * 1.8;

        // Write to target — the update loop lerps actual velocity toward this,
        // low-pass-filtering out hand jitter without dulling intentional sweeps.
        targetAngularVelocity.theta = MathUtils.clamp(
            -movementX * rotateSpeed * 120 * zoomScaleFactor,
            -angularVelocityCap,
            angularVelocityCap,
        );
        targetAngularVelocity.phi = MathUtils.clamp(
            -movementY * rotateSpeed * 120 * zoomScaleFactor,
            -angularVelocityCap,
            angularVelocityCap,
        );
    }

    function onPointerEnd(event: PointerEvent) {
        trackedPointers.delete(event.pointerId);
        if (event.pointerId === activePointerId) {
            isDragging = false;
            activePointerId = null;
            // Stop feeding new target so inertia decays naturally from current velocity.
            targetAngularVelocity.theta = 0;
            targetAngularVelocity.phi = 0;
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

        if (isDragging) {
            // Low-pass filter: smoothly blend actual velocity toward the raw input target.
            // Fast jitter (hand shake) decays before it reaches angularVelocity;
            // slow intentional swipes pass through cleanly.
            const inputBlendFactor = 1 - Math.exp(-inputSmoothing * deltaSeconds);
            angularVelocity.theta = MathUtils.lerp(
                angularVelocity.theta,
                targetAngularVelocity.theta,
                inputBlendFactor,
            );
            angularVelocity.phi = MathUtils.lerp(angularVelocity.phi, targetAngularVelocity.phi, inputBlendFactor);
        } else {
            // Released — decay naturally for inertia feel.
            angularVelocity.theta *= dampingFactor;
            angularVelocity.phi *= dampingFactor;
        }

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
