import {
    AddEquation,
    BufferAttribute,
    BufferGeometry,
    CustomBlending,
    OneFactor,
    PerspectiveCamera,
    Points,
    ShaderMaterial,
    Vector3,
} from 'three';

import type { ShootingStarsHandle, ShootingStarsOptions } from '@/modules/Globe/types/globe.types';

/**
 * Occasional shooting stars — a bright glowing head followed by a small
 * tapering trail that thins and fades toward the tail.
 *
 * Each star occupies TRAIL_LEN consecutive vertices in a shared Points
 * geometry. The head vertex (index 0) is full-size and bright. Each
 * successive trail vertex is smaller and more transparent, creating a
 * comet-like smear behind the head.
 */

const TRAIL_LEN = 8; // vertices per star (head + 7 trail points)
const TRAIL_SPACING = 2.2; // world-unit gap between consecutive trail points

/** ↑↓ TUNE THIS — world-units per second. Higher = faster streak. */
const DEFAULT_SPEED = 100;

interface ShootingStarSlot {
    active: boolean;
    elapsed: number;
    duration: number;
    startX: number;
    startY: number;
    startZ: number;
    dirX: number;
    dirY: number;
    dirZ: number;
    totalDist: number;
    nextFireTime: number;
}

export function createShootingStars(
    camera: PerspectiveCamera,
    options: ShootingStarsOptions = {},
): ShootingStarsHandle {
    const {
        radius = 76,
        minIntervalSeconds = 5,
        maxIntervalSeconds = 15,
        maxConcurrent = 1,
        speed = DEFAULT_SPEED,
    } = options;

    const totalVertices = maxConcurrent * TRAIL_LEN;
    const positions = new Float32Array(totalVertices * 3);
    const alphas = new Float32Array(totalVertices);
    const sizes = new Float32Array(totalVertices);

    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(positions, 3));
    geometry.setAttribute('aAlpha', new BufferAttribute(alphas, 1));
    geometry.setAttribute('aSize', new BufferAttribute(sizes, 1));

    // ── Shader ─────────────────────────────────────────────────────────
    // Each vertex is an independent point sprite. aAlpha and aSize shrink
    // toward the tail so the trail tapers naturally.
    const vertexShader = /* glsl */ `
        attribute float aAlpha;
        attribute float aSize;
        varying float vAlpha;

        void main() {
            vAlpha = aAlpha;
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = aSize * (300.0 / -mvPosition.z);
            gl_Position = projectionMatrix * mvPosition;
        }
    `;

    const fragmentShader = /* glsl */ `
        varying float vAlpha;

        void main() {
            vec2 centered = gl_PointCoord - vec2(0.5);
            float dist = length(centered);
            if (dist > 0.5) discard;

            float core = exp(-dist * 30.0);
            float glow = exp(-dist * 22.5);
            float intensity = (core * 2.2 + glow * 0.6) * vAlpha;

            // White-hot core fades to aurora-blue at the edge.
            vec3 color = mix(vec3(0.6, 0.88, 1.0), vec3(1.0, 1.0, 1.0), core);

            gl_FragColor = vec4(color * intensity, clamp(intensity, 0.0, 1.0));
        }
    `;

    const material = new ShaderMaterial({
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        depthTest: true,
        blending: CustomBlending,
        blendEquation: AddEquation,
        blendSrc: OneFactor,
        blendDst: OneFactor,
        blendEquationAlpha: AddEquation,
        blendSrcAlpha: OneFactor,
        blendDstAlpha: OneFactor,
    });

    const points = new Points(geometry, material);
    points.frustumCulled = false;
    points.renderOrder = 0;
    points.name = 'memory-atlas/shooting-stars';

    // ── Slot pool ──────────────────────────────────────────────────────
    const slots: ShootingStarSlot[] = [];
    for (let slotIndex = 0; slotIndex < maxConcurrent; slotIndex++) {
        slots.push({
            active: false,
            elapsed: 0,
            duration: 0,
            startX: 0,
            startY: 0,
            startZ: 0,
            dirX: 0,
            dirY: 0,
            dirZ: 0,
            totalDist: 0,
            nextFireTime: 2 + slotIndex * (minIntervalSeconds / maxConcurrent) + Math.random() * 3,
        });
    }

    const scratchStart = new Vector3();
    const scratchEnd = new Vector3();

    function activateSlot(slot: ShootingStarSlot, currentElapsed: number): void {
        slot.active = true;
        slot.elapsed = 0;
        // duration is derived from distance ÷ speed so the star always
        // crosses the screen in a predictable time regardless of angle.
        // We don't know totalDist yet, so set a placeholder; it is
        // overwritten below once we have the geometry.
        slot.duration = 0; // overwritten below
        slot.nextFireTime =
            currentElapsed + minIntervalSeconds + Math.random() * (maxIntervalSeconds - minIntervalSeconds);

        camera.updateMatrixWorld(false);
        const fromLeft = Math.random() < 0.5;
        const startNdcX = fromLeft ? -1.2 : 1.2;
        const startNdcY = -0.5 + Math.random() * 1.0;
        const endNdcX = fromLeft ? 1.2 : -1.2;
        const endNdcY = startNdcY - 0.08 - Math.random() * 0.18;

        scratchStart.set(startNdcX, startNdcY, 1).unproject(camera).normalize().multiplyScalar(radius);
        scratchEnd.set(endNdcX, endNdcY, 1).unproject(camera).normalize().multiplyScalar(radius);

        slot.startX = scratchStart.x;
        slot.startY = scratchStart.y;
        slot.startZ = scratchStart.z;

        const dx = scratchEnd.x - scratchStart.x;
        const dy = scratchEnd.y - scratchStart.y;
        const dz = scratchEnd.z - scratchStart.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        slot.totalDist = dist;
        slot.duration = dist / speed;
        slot.dirX = dx / dist;
        slot.dirY = dy / dist;
        slot.dirZ = dz / dist;
    }

    // ── Per-frame update ───────────────────────────────────────────────
    function update(elapsedSeconds: number, deltaSeconds: number): void {
        let dirty = false;

        for (let slotIndex = 0; slotIndex < maxConcurrent; slotIndex++) {
            const slot = slots[slotIndex]!;
            const baseVertex = slotIndex * TRAIL_LEN;

            if (!slot.active) {
                if (elapsedSeconds >= slot.nextFireTime) {
                    activateSlot(slot, elapsedSeconds);
                } else {
                    continue;
                }
            }

            slot.elapsed += deltaSeconds;
            const progress = slot.elapsed / slot.duration;

            if (progress >= 1.0) {
                slot.active = false;
                // Zero out all trail vertices for this slot.
                for (let trailIndex = 0; trailIndex < TRAIL_LEN; trailIndex++) {
                    const vertexIndex = baseVertex + trailIndex;
                    positions[vertexIndex * 3] = 0;
                    positions[vertexIndex * 3 + 1] = 0;
                    positions[vertexIndex * 3 + 2] = 0;
                    alphas[vertexIndex] = 0;
                }
                dirty = true;
                continue;
            }

            // Ease-out movement + sine fade envelope.
            const eased = 1 - (1 - progress) * (1 - progress);
            const fade = Math.sin(Math.PI * progress);
            const headTravel = eased * slot.totalDist;

            // Head position.
            const headX = slot.startX + slot.dirX * headTravel;
            const headY = slot.startY + slot.dirY * headTravel;
            const headZ = slot.startZ + slot.dirZ * headTravel;

            // Write head + trail vertices. Trail[i] sits i * TRAIL_SPACING
            // units behind the head along the travel direction.
            for (let trailIndex = 0; trailIndex < TRAIL_LEN; trailIndex++) {
                const vertexIndex = baseVertex + trailIndex;
                const trailOffset = trailIndex * TRAIL_SPACING;

                positions[vertexIndex * 3] = headX - slot.dirX * trailOffset;
                positions[vertexIndex * 3 + 1] = headY - slot.dirY * trailOffset;
                positions[vertexIndex * 3 + 2] = headZ - slot.dirZ * trailOffset;

                // t = 0 at head, 1 at last trail point.
                const trailT = trailIndex / (TRAIL_LEN - 1);
                // Quadratic falloff — tail dims and shrinks quickly.
                const trailFade = (1 - trailT) * (1 - trailT);
                alphas[vertexIndex] = fade * trailFade;
                sizes[vertexIndex] = 10 * (1 - trailT * 0.85);
            }

            dirty = true;
        }

        if (dirty) {
            (geometry.attributes['position'] as BufferAttribute).needsUpdate = true;
            (geometry.attributes['aAlpha'] as BufferAttribute).needsUpdate = true;
            (geometry.attributes['aSize'] as BufferAttribute).needsUpdate = true;
        }
    }

    function dispose(): void {
        geometry.dispose();
        material.dispose();
    }

    return { object: points, update, dispose };
}
