import {
    AddEquation,
    BufferAttribute,
    BufferGeometry,
    CustomBlending,
    OneFactor,
    Points,
    ShaderMaterial,
    Vector3,
} from 'three';

import type { CosmicPhenomenaHandle, CosmicPhenomenaOptions } from '@/modules/Globe/types/globe.types';

/**
 * Sprinkle the celestial sphere with rare astrophysical phenomena.
 * This is the *fun* layer of the sky — the things you'd hope to see if you
 * stared at the universe long enough.
 *
 * All phenomena share a single `THREE.Points` instance with per-vertex
 * attributes describing color, base size, and a `type` discriminator.
 * The shader branches on type to produce wildly different visuals.
 *
 *   Type 0 — White dwarf
 *     Tiny, hot, intensely bright blue-white pinpoint. Steady, sharp core.
 *     Hero stars: they punch above the bloom luminance threshold and glow.
 *
 *   Type 1 — Red giant
 *     Large, warm orange-red, slow heartbeat pulsation (~0.6 rad/s).
 *
 *   Type 2 — Pulsar
 *     Small, blue-white, rapid lighthouse pulses via pow(max(sin(t*7),0),12).
 *     Almost invisible between beats, blinding at peak.
 *
 *   Type 3 — Binary
 *     Two stars orbiting a shared barycenter. Positions are updated in JS
 *     each frame (cheap — only 2 vertices), shader treats them as normal
 *     mid-bright stars.
 *
 *   Type 4 — Supernova
 *     Dormant most of the time. On a long timer it explodes: the size
 *     balloons, brightness ramps along a bell curve, color shifts from
 *     blue-white → white → warm orange-red over ~1.6 s, then it fades.
 *     The per-vertex `aIntensity` attribute is driven from JS.
 *
 * Total vertex count is tiny (≤ ~10), so per-frame attribute uploads are
 * trivial. One draw call for the entire spectacle.
 */

const TYPE_WHITE_DWARF = 0;
const TYPE_RED_GIANT = 1;
const TYPE_PULSAR = 2;
const TYPE_BINARY = 3;
const TYPE_SUPERNOVA = 4;

interface BinaryOrbitDescriptor {
    primaryIndex: number;
    secondaryIndex: number;
    center: Vector3;
    basisU: Vector3; // in-plane unit vector
    basisV: Vector3; // in-plane unit vector perpendicular to basisU
    separation: number;
    angularSpeed: number; // radians per second
    phaseOffset: number;
}

interface SupernovaDescriptor {
    index: number;
    cooldownSeconds: number; // counts down to 0, then flashes
    activeElapsed: number; // -1 when dormant
    flashDuration: number;
}

export function createCosmicPhenomena(options: CosmicPhenomenaOptions = {}): CosmicPhenomenaHandle {
    const {
        whiteDwarfCount = 2,
        redGiantCount = 3,
        pulsarCount = 1,
        binarySystemCount = 1,
        supernovaIntervalSeconds = 35,
        supernovaFlashDuration = 1.6,
        radius = 70,
    } = options;

    const totalVertexCount = whiteDwarfCount + redGiantCount + pulsarCount + binarySystemCount * 2 + 1;

    const positions = new Float32Array(totalVertexCount * 3);
    const colors = new Float32Array(totalVertexCount * 3);
    const baseSizes = new Float32Array(totalVertexCount);
    const types = new Float32Array(totalVertexCount);
    const intensities = new Float32Array(totalVertexCount); // mainly used by supernova

    const binaryOrbits: BinaryOrbitDescriptor[] = [];
    let supernova: SupernovaDescriptor | null = null;

    // ── Placement helpers ─────────────────────────────────────────────
    function placeOnSphere(target: Vector3): Vector3 {
        const azimuth = Math.random() * Math.PI * 2;
        const polarCosine = Math.random() * 2 - 1;
        const polarSine = Math.sqrt(1 - polarCosine * polarCosine);
        target.set(
            radius * polarSine * Math.cos(azimuth),
            radius * polarSine * Math.sin(azimuth),
            radius * polarCosine,
        );
        return target;
    }

    function writeVertex(
        index: number,
        position: Vector3,
        rgb: [number, number, number],
        baseSize: number,
        type: number,
    ) {
        positions[index * 3 + 0] = position.x;
        positions[index * 3 + 1] = position.y;
        positions[index * 3 + 2] = position.z;
        colors[index * 3 + 0] = rgb[0];
        colors[index * 3 + 1] = rgb[1];
        colors[index * 3 + 2] = rgb[2];
        baseSizes[index] = baseSize;
        types[index] = type;
        intensities[index] = 0;
    }

    // ── Populate vertices ─────────────────────────────────────────────
    const scratchPosition = new Vector3();
    let cursor = 0;

    for (let starIndex = 0; starIndex < whiteDwarfCount; starIndex++) {
        placeOnSphere(scratchPosition);
        // baseSize is large so the sprite has room for diffraction spikes;
        // the visible core stays tiny because sharpness is cranked up.
        writeVertex(cursor++, scratchPosition, [0.78, 0.86, 1.0], 18.0, TYPE_WHITE_DWARF);
    }

    for (let starIndex = 0; starIndex < redGiantCount; starIndex++) {
        placeOnSphere(scratchPosition);
        writeVertex(cursor++, scratchPosition, [1.0, 0.5, 0.28], 10.0, TYPE_RED_GIANT);
    }

    for (let starIndex = 0; starIndex < pulsarCount; starIndex++) {
        placeOnSphere(scratchPosition);
        writeVertex(cursor++, scratchPosition, [0.65, 0.82, 1.0], 16.0, TYPE_PULSAR);
    }

    for (let systemIndex = 0; systemIndex < binarySystemCount; systemIndex++) {
        placeOnSphere(scratchPosition);
        const center = scratchPosition.clone();

        // Build an orthonormal basis (u, v) in the plane tangent to the celestial
        // sphere at `center`. The binary orbits in that plane — from our vantage
        // point at the origin we see them sweep across the sky in a circle.
        const radialDirection = center.clone().normalize();
        const arbitraryAxis = Math.abs(radialDirection.x) < 0.9 ? new Vector3(1, 0, 0) : new Vector3(0, 1, 0);
        const basisU = new Vector3().crossVectors(radialDirection, arbitraryAxis).normalize();
        const basisV = new Vector3().crossVectors(radialDirection, basisU).normalize();

        const separation = 1.6; // world units between the two stars — visibly two stars
        const angularSpeed = 0.35 + Math.random() * 0.2; // rad/sec
        const phaseOffset = Math.random() * Math.PI * 2;

        const primaryIndex = cursor;
        const secondaryIndex = cursor + 1;
        // Initial positions are placeholders; update() rewrites them every frame.
        // Two clearly distinct companions: a hot blue-white primary and a warm K-class secondary.
        writeVertex(cursor++, center, [0.85, 0.93, 1.0], 5.5, TYPE_BINARY);
        writeVertex(cursor++, center, [1.0, 0.78, 0.45], 4.5, TYPE_BINARY);

        binaryOrbits.push({
            primaryIndex,
            secondaryIndex,
            center,
            basisU,
            basisV,
            separation,
            angularSpeed,
            phaseOffset,
        });
    }

    // Supernova — last vertex slot.
    placeOnSphere(scratchPosition);
    const supernovaIndex = cursor;
    writeVertex(cursor++, scratchPosition, [0.9, 0.95, 1.0], 22.0, TYPE_SUPERNOVA);
    supernova = {
        index: supernovaIndex,
        // First explosion happens after a short delay so the user sees one early.
        cooldownSeconds: 8,
        activeElapsed: -1,
        flashDuration: supernovaFlashDuration,
    };

    // ── Geometry & material ───────────────────────────────────────────
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(positions, 3));
    geometry.setAttribute('aStarColor', new BufferAttribute(colors, 3));
    geometry.setAttribute('aBaseSize', new BufferAttribute(baseSizes, 1));
    geometry.setAttribute('aType', new BufferAttribute(types, 1));
    geometry.setAttribute('aIntensity', new BufferAttribute(intensities, 1));

    const positionAttribute = geometry.getAttribute('position') as BufferAttribute;
    const intensityAttribute = geometry.getAttribute('aIntensity') as BufferAttribute;

    // Shader notes:
    //
    // The vertex shader branches on `aType` to produce different visuals.
    // GLSL branches on uniform/attribute values are fine for tiny vertex
    // counts like this (~10). We compute four varyings the fragment needs:
    //   vColor          — the per-star color (possibly shifted, e.g. supernova)
    //   vBrightness     — multiplied into the fragment's intensity
    //   vCoreSharpness  — controls exponential falloff of the visible core
    //   vSpikeStrength  — diffraction-spike amplitude (Hubble/JWST aesthetic).
    //                     Zero for soft cool stars, non-zero for hot point sources.
    //   vRingStrength   — supernova shockwave ring intensity (0 when dormant).
    //
    // Because diffraction spikes need to extend beyond the visible core, the
    // sprite (`gl_PointSize`) is much larger than the apparent star. The core
    // sharpness keeps the actual disc small inside the bigger sprite.
    const vertexShader = /* glsl */ `
    attribute vec3 aStarColor;
    attribute float aBaseSize;
    attribute float aType;
    attribute float aIntensity;

    uniform float uTime;
    uniform float uPixelRatio;

    varying vec3 vColor;
    varying float vBrightness;
    varying float vCoreSharpness;
    varying float vSpikeStrength;
    varying float vRingStrength;

    void main() {
      vec3 color = aStarColor;
      float size = aBaseSize;
      float brightness = 1.0;
      float sharpness = 22.0;
      float spikeStrength = 0.0;
      float ringStrength = 0.0;

      if (aType < 0.5) {
        // ── White dwarf: dense, blowtorch-blue with sharp 8-spike starburst
        // Each dwarf gets its own phase via a position-derived seed so the
        // field shimmers rather than pulsing in unison. Two layered sines
        // (slow swell + faster flicker) give it a living, breathing feel.
        float dwarfSeed = fract(sin(dot(position.xyz, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
        float phase = dwarfSeed * 6.2831853;
        float slow = sin(uTime * 1.1 + phase) * 0.18;
        float fast = sin(uTime * 4.3 + phase * 1.7) * 0.08;
        float pulse = 1.0 + slow + fast;
        brightness = 3.0 * pulse;
        sharpness = 90.0;        // visible disc stays tiny inside the 18-unit sprite
        spikeStrength = 0.55 * pulse;
      } else if (aType < 1.5) {
        // ── Red giant: huge, fluffy, limb-darkened ─────────────────
        float breath = 0.82 + sin(uTime * 0.6) * 0.18;
        size *= breath;
        brightness = 0.95 * breath; // halo dominates the visible star
        sharpness = 4.0;            // very soft, smooth radial gradient
      } else if (aType < 2.5) {
        // ── Pulsar: gentle, slow lighthouse breath ────────────────
        // Soft sinusoidal breath between 0.6 and 1.0, ~5 s period. No more
        // strobing — the star reads as a calm beating heart.
        float beat = 0.6 + 0.4 * pow(max(sin(uTime * 1.2), 0.0), 3.0);
        brightness = 2.0 * beat;
        sharpness = 80.0;
        spikeStrength = 0.45 + beat * 0.15;
      } else if (aType < 3.5) {
        // ── Binary companion: positions handled in JS ──────────────
        brightness = 1.6;
        sharpness = 35.0;
        spikeStrength = 0.25;
      } else {
        // ── Supernova: aIntensity drives everything (0 = dormant) ──
        float t = clamp(aIntensity, 0.0, 1.0);
        // Color sweeps blue-white → white → warm red as the shockwave cools.
        vec3 cool   = vec3(0.78, 0.88, 1.00);
        vec3 hot    = vec3(1.00, 0.98, 0.92);
        vec3 dying  = vec3(1.00, 0.45, 0.20);
        vec3 phase = mix(cool, hot, smoothstep(0.0, 0.4, t));
        color = mix(phase, dying, smoothstep(0.55, 1.0, t));
        // Hold full sprite size so the expanding ring has room to grow.
        brightness = t * 8.0;
        sharpness = mix(60.0, 3.0, t);
        spikeStrength = t * 1.2;
        ringStrength = t;
      }

      vColor = color;
      vBrightness = brightness;
      vCoreSharpness = sharpness;
      vSpikeStrength = spikeStrength;
      vRingStrength = ringStrength;

      vec4 modelViewPosition = modelViewMatrix * vec4(position, 1.0);
      gl_Position = projectionMatrix * modelViewPosition;
      gl_PointSize = size * uPixelRatio * (300.0 / -modelViewPosition.z);
    }
  `;

    const fragmentShader = /* glsl */ `
    varying vec3 vColor;
    varying float vBrightness;
    varying float vCoreSharpness;
    varying float vSpikeStrength;
    varying float vRingStrength;

    void main() {
      vec2 centered = gl_PointCoord - vec2(0.5);
      float distanceFromCenter = length(centered);
      if (distanceFromCenter > 0.5) discard;

      // ── Stellar core ──────────────────────────────────────────────
      // Single tight peak; bloom handles the visible glow on bright stars.
      float core = exp(-distanceFromCenter * vCoreSharpness);
      float intensity = core * vBrightness;

      // ── Diffraction spikes (4-point primary cross, Hubble/JWST look) ─
      // Hot point sources show this signature; soft stars set spike = 0.
      // The cross-band tightens with distance from core (taper term) so each
      // spike looks dense at the heart and slowly narrows into the void.
      if (vSpikeStrength > 0.001) {
        float ax = abs(centered.x);
        float ay = abs(centered.y);
        // 30% shorter along the spike (5.7 vs 4.0); cross-section narrows
        // as ax/ay grows, giving the dense-core-tapering-tail silhouette.
        float spikeH = exp(-ay * (180.0 + ax * 800.0)) * exp(-ax * 5.7);
        float spikeV = exp(-ax * (180.0 + ay * 800.0)) * exp(-ay * 5.7);
        intensity += (spikeH + spikeV) * vSpikeStrength * vBrightness;

        // ── Secondary 45° spikes — only on the hottest sources ───────
        // Together with the primary cross this forms an 8-point starburst,
        // the signature look of a real JWST hero shot. Smoothstep gates it
        // so weaker spike sources stay 4-pointed.
        float diagonalStrength = smoothstep(0.45, 0.6, vSpikeStrength);
        if (diagonalStrength > 0.0) {
          vec2 rotated = vec2(centered.x + centered.y, centered.x - centered.y) * 0.7071;
          float dx = abs(rotated.x);
          float dy = abs(rotated.y);
          // 30% shorter (8.6 vs 6.0); same taper trick narrows the tail.
          float diagH = exp(-dy * (260.0 + dx * 1100.0)) * exp(-dx * 8.6);
          float diagV = exp(-dx * (260.0 + dy * 1100.0)) * exp(-dy * 8.6);
          intensity += (diagH + diagV) * diagonalStrength * vBrightness * 0.45;
        }
      }

      // ── Supernova shockwave ring ──────────────────────────────────
      // A thin bright annulus that grows outward and fades as it expands.
      if (vRingStrength > 0.001) {
        float ringRadius = mix(0.05, 0.46, vRingStrength);
        float ringThickness = mix(0.015, 0.05, vRingStrength);
        float ringFalloff = exp(-pow((distanceFromCenter - ringRadius) / ringThickness, 2.0));
        intensity += ringFalloff * (1.0 - vRingStrength) * 4.0 * vBrightness;
      }

      // No outer halo / no envelope — these are sharp spike-cross stars.
      // The core is already tight, the spikes carry the glamour, and the
      // discard above gives a clean edge.
      vec3 finalColor = vColor + max(intensity - 1.0, 0.0) * vec3(0.6);
      // Alpha tracks emitted light — see Starfield.ts. Stops the sprite
      // quad from becoming a black disc over the page gradient.
      gl_FragColor = vec4(finalColor * intensity, clamp(intensity, 0.0, 1.0));
    }
  `;

    const material = new ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: {
            uTime: { value: 0 },
            uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
        },
        transparent: true,
        // Pure additive blend (see Starfield.ts for the full rationale): we
        // must NOT write alpha = 1 across the whole sprite quad, or we
        // punch an opaque hole through the canvas and the CSS nebula
        // gradient turns into a black disc behind every star.
        blending: CustomBlending,
        blendEquation: AddEquation,
        blendSrc: OneFactor,
        blendDst: OneFactor,
        blendEquationAlpha: AddEquation,
        blendSrcAlpha: OneFactor,
        blendDstAlpha: OneFactor,
        depthWrite: false,
        depthTest: true,
    });

    const points = new Points(geometry, material);
    points.frustumCulled = false;
    points.renderOrder = -1;
    points.name = 'memory-atlas/cosmic-phenomena';

    // ── Per-frame update ──────────────────────────────────────────────
    const scratchOrbitPosition = new Vector3();

    function update(elapsedSeconds: number, deltaSeconds: number) {
        material.uniforms['uTime']!.value = elapsedSeconds;

        // Binary orbits: rotate each pair around their barycenter in their plane.
        let positionsDirty = false;
        for (const orbit of binaryOrbits) {
            const angle = elapsedSeconds * orbit.angularSpeed + orbit.phaseOffset;
            const cosAngle = Math.cos(angle);
            const sinAngle = Math.sin(angle);
            const halfSeparation = orbit.separation * 0.5;

            // Primary star = +offset, secondary star = -offset along the orbit.
            scratchOrbitPosition
                .copy(orbit.basisU)
                .multiplyScalar(cosAngle * halfSeparation)
                .addScaledVector(orbit.basisV, sinAngle * halfSeparation)
                .add(orbit.center);
            positions[orbit.primaryIndex * 3 + 0] = scratchOrbitPosition.x;
            positions[orbit.primaryIndex * 3 + 1] = scratchOrbitPosition.y;
            positions[orbit.primaryIndex * 3 + 2] = scratchOrbitPosition.z;

            scratchOrbitPosition
                .copy(orbit.basisU)
                .multiplyScalar(-cosAngle * halfSeparation)
                .addScaledVector(orbit.basisV, -sinAngle * halfSeparation)
                .add(orbit.center);
            positions[orbit.secondaryIndex * 3 + 0] = scratchOrbitPosition.x;
            positions[orbit.secondaryIndex * 3 + 1] = scratchOrbitPosition.y;
            positions[orbit.secondaryIndex * 3 + 2] = scratchOrbitPosition.z;

            positionsDirty = true;
        }

        // Supernova timer.
        if (supernova) {
            if (supernova.activeElapsed >= 0) {
                // Currently exploding.
                supernova.activeElapsed += deltaSeconds;
                const normalized = supernova.activeElapsed / supernova.flashDuration;
                if (normalized >= 1) {
                    // Done. Cool off, schedule the next one.
                    intensities[supernova.index] = 0;
                    supernova.activeElapsed = -1;
                    supernova.cooldownSeconds = supernovaIntervalSeconds;
                } else {
                    // Bell-curve intensity: rises fast, lingers, decays.
                    // sin(πx) peaks at x=0.5 = 1.0, smooth and symmetric.
                    intensities[supernova.index] = Math.sin(normalized * Math.PI);
                }
                intensityAttribute.needsUpdate = true;
            } else {
                supernova.cooldownSeconds -= deltaSeconds;
                if (supernova.cooldownSeconds <= 0) supernova.activeElapsed = 0;
            }
        }

        if (positionsDirty) positionAttribute.needsUpdate = true;
    }

    function dispose() {
        geometry.dispose();
        material.dispose();
    }

    return { object: points, update, dispose };
}
