import {
    AddEquation,
    BufferAttribute,
    BufferGeometry,
    Color,
    CustomBlending,
    OneFactor,
    Points,
    ShaderMaterial,
    Vector3,
} from 'three';

import type { StarfieldHandle, StarfieldOptions } from '@/modules/Globe/types/globe.types';

/**
 * Build a single-draw-call, GPU-shaded starfield designed to be jaw-dropping
 * rather than utilitarian.
 *
 * Design notes:
 *
 * - One `THREE.Points` instance, one `ShaderMaterial`. ~8k stars at the cost
 *   of one draw call.
 *
 * - Stars carry per-vertex attributes: a color sampled from a stellar-class
 *   palette (blue O-type → red M-dwarf), a size drawn from a power-law
 *   distribution (most pinpoints, a few heroes), and a random twinkle seed.
 *
 * - The vertex shader animates each star's effective size with a sine wave
 *   offset by its seed — twinkling. Dim stars twinkle harder than bright
 *   ones, so the sky breathes without flickering.
 *
 * - The fragment shader builds a soft circular sprite procedurally via
 *   smoothstep on `gl_PointCoord`. No texture file, no transparency hacks,
 *   no aliasing on the disc edge.
 *
 * - The bright tail of the size distribution pushes hero stars above the
 *   bloom luminance threshold (0.35) so post-processing catches them and
 *   they glow. Small stars stay below threshold and remain crisp pinpoints.
 *   This contrast is what makes the field look "real" instead of "dots".
 *
 * - Render order is pinned behind everything, depth writes are off, frustum
 *   culling is off — stars never fight the globe for the depth buffer and
 *   never pop out of view at the edges.
 */
export function createStarfield(options: StarfieldOptions = {}): StarfieldHandle {
    const {
        uniformStarCount = 6000,
        galacticBandStarCount = 2000,
        radius = 80,
        galacticTilt = 0.35,
        sizeScale = 1,
    } = options;

    const totalStarCount = uniformStarCount + galacticBandStarCount;

    // ── Stellar palette ────────────────────────────────────────────────
    // Approximate sRGB colors for stellar classes O → M, ordered hot → cool.
    // Weights are tuned for visual richness, not astrophysical accuracy:
    // white dominates, blue and red are spice.
    const stellarPalette: Array<{ color: Color; weight: number }> = [
        { color: new Color(0.61, 0.71, 1.0), weight: 0.05 }, // O — blue
        { color: new Color(0.67, 0.75, 1.0), weight: 0.08 }, // B — blue-white
        { color: new Color(0.85, 0.88, 1.0), weight: 0.22 }, // A — white
        { color: new Color(1.0, 0.98, 0.95), weight: 0.25 }, // F — yellow-white
        { color: new Color(1.0, 0.94, 0.81), weight: 0.2 }, // G — yellow (Sun)
        { color: new Color(1.0, 0.83, 0.66), weight: 0.13 }, // K — orange
        { color: new Color(1.0, 0.71, 0.52), weight: 0.07 }, // M — red-orange
    ];

    function sampleStellarColor(): Color {
        const roll = Math.random();
        let cumulative = 0;
        for (const { color, weight } of stellarPalette) {
            cumulative += weight;
            if (roll <= cumulative) return color;
        }
        return stellarPalette[stellarPalette.length - 1]!.color;
    }

    // ── Position samplers ──────────────────────────────────────────────
    function placeOnSphere(targetVector: Vector3): Vector3 {
        // Uniform-on-sphere via inverse CDF.
        const azimuth = Math.random() * Math.PI * 2;
        const polarCosine = Math.random() * 2 - 1;
        const polarSine = Math.sqrt(1 - polarCosine * polarCosine);
        targetVector.set(
            radius * polarSine * Math.cos(azimuth),
            radius * polarSine * Math.sin(azimuth),
            radius * polarCosine,
        );
        return targetVector;
    }

    function placeOnGalacticBand(targetVector: Vector3): Vector3 {
        const azimuth = Math.random() * Math.PI * 2;
        // Sum of four uniforms ≈ a tight gaussian-ish band hugging the equator.
        const bandThickness = 0.22;
        const bandOffset = (Math.random() + Math.random() + Math.random() + Math.random() - 2) * bandThickness;
        const polar = Math.PI / 2 + bandOffset;
        const polarSine = Math.sin(polar);

        const x = radius * polarSine * Math.cos(azimuth);
        const yFlat = radius * polarSine * Math.sin(azimuth);
        const zFlat = radius * Math.cos(polar);
        // Tilt the band by rotating around the X axis.
        const cosTilt = Math.cos(galacticTilt);
        const sinTilt = Math.sin(galacticTilt);
        targetVector.set(x, yFlat * cosTilt - zFlat * sinTilt, yFlat * sinTilt + zFlat * cosTilt);
        return targetVector;
    }

    // ── Size sampler ───────────────────────────────────────────────────
    // Power-law: vast majority pinpoints, a handful of heroes.
    // `Math.pow(u, 8)` skews hard toward 0; we then scale to a 0.5–6.5 range.
    function sampleStarSize(): number {
        const skew = Math.pow(Math.random(), 8);
        return (0.5 + skew * 6) * sizeScale;
    }

    // ── Build buffers ──────────────────────────────────────────────────
    const positions = new Float32Array(totalStarCount * 3);
    const colors = new Float32Array(totalStarCount * 3);
    const sizes = new Float32Array(totalStarCount);
    const twinkleSeeds = new Float32Array(totalStarCount);

    const scratch = new Vector3();

    for (let starIndex = 0; starIndex < totalStarCount; starIndex++) {
        if (starIndex < uniformStarCount) {
            placeOnSphere(scratch);
        } else {
            placeOnGalacticBand(scratch);
        }

        positions[starIndex * 3 + 0] = scratch.x;
        positions[starIndex * 3 + 1] = scratch.y;
        positions[starIndex * 3 + 2] = scratch.z;

        const starColor = sampleStellarColor();
        colors[starIndex * 3 + 0] = starColor.r;
        colors[starIndex * 3 + 1] = starColor.g;
        colors[starIndex * 3 + 2] = starColor.b;

        sizes[starIndex] = sampleStarSize();
        twinkleSeeds[starIndex] = Math.random();
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(positions, 3));
    geometry.setAttribute('aStarColor', new BufferAttribute(colors, 3));
    geometry.setAttribute('aStarSize', new BufferAttribute(sizes, 1));
    geometry.setAttribute('aTwinkleSeed', new BufferAttribute(twinkleSeeds, 1));

    // ── Shader ─────────────────────────────────────────────────────────
    // Notes on the math:
    //
    // Vertex:
    //   - `gl_PointSize` is scaled by `(300 / -mvPosition.z)` so distant stars
    //     get smaller in screen space — perspective for point sprites.
    //   - `twinkleAmount` is inverse to brightness: dim stars (size < 2)
    //     fluctuate ±35%, bright heroes only ±10%. Sine offset by seed.
    //
    // Fragment:
    //   - `smoothstep(0.5, 0.0, dist)` gives a soft falloff disc.
    //   - We `pow(core, 2.2)` to tighten the highlight so the center pops.
    //   - Final color is multiplied by `vBrightness` (size-derived) so
    //     hero stars exceed the bloom luminance threshold.
    const vertexShader = /* glsl */ `
    attribute vec3 aStarColor;
    attribute float aStarSize;
    attribute float aTwinkleSeed;

    uniform float uTime;
    uniform float uPixelRatio;

    varying vec3 vColor;
    varying float vBrightness;
    varying float vRaySeed;

    void main() {
      vColor = aStarColor;
      vRaySeed = aTwinkleSeed;

      // Dimmer stars twinkle more; bright heroes are steadier.
      float steadiness = clamp(aStarSize / 6.0, 0.0, 1.0);
      float twinkleAmplitude = mix(0.35, 0.10, steadiness);
      float twinkle = 1.0 + sin(uTime * 1.5 + aTwinkleSeed * 6.2831853) * twinkleAmplitude;

      // Brightness exposed to the fragment so heroes blow out into bloom.
      vBrightness = mix(0.7, 1.6, steadiness) * twinkle;

      vec4 modelViewPosition = modelViewMatrix * vec4(position, 1.0);
      gl_Position = projectionMatrix * modelViewPosition;
      gl_PointSize = aStarSize * twinkle * uPixelRatio * (300.0 / -modelViewPosition.z);
    }
  `;

    const fragmentShader = /* glsl */ `
    varying vec3 vColor;
    varying float vBrightness;
    varying float vRaySeed;

    void main() {
      vec2 centered = gl_PointCoord - vec2(0.5);
      float distanceFromCenter = length(centered);
      if (distanceFromCenter > 0.5) discard;

      // Tight bright peak. No circular halo — the outer glow comes from
      // a handful of scattered narrow light beams below, not a uniform ring.
      float core = exp(-distanceFromCenter * 22.0);
      float intensity = core * vBrightness;

      // ── Outer light, bright stars only ──────────────────────────────
      // Each bright star randomly picks one of two styles based on its
      // seed, so the field reads as variety instead of repetition:
      //   • BEAM style — six razor-thin radial rays rotated by the seed.
      //   • HALO style — soft round-ish glow with angular wobble so the
      //     silhouette never becomes a perfect circle.
      // Dim stars contribute nothing — the factor scales with
      // (vBrightness - 1.0) which is negative for them.
      float brightnessExcess = max(vBrightness - 1.0, 0.0);
      if (brightnessExcess > 0.0) {
        float angle = atan(centered.y, centered.x);
        float seedAngle = vRaySeed * 6.2831853;
        float style = fract(vRaySeed * 7.319);

        if (style < 0.5) {
          // Beam halo: six sharp peaks via pow(abs(cos(angle*3)), big N).
          float radialFalloff = exp(-distanceFromCenter * 9.0);
          float rays = pow(abs(cos((angle - seedAngle) * 3.0)), 220.0);
          intensity += rays * radialFalloff * brightnessExcess * 1.2;
        } else {
          // Soft glow with two stacked low-frequency wobbles to break the
          // perfect circle. Wobble modulates the falloff rate per-angle —
          // some directions reach further out than others.
          float wobble = 1.0
                       + 0.28 * sin(angle * 4.0 + seedAngle)
                       + 0.14 * sin(angle * 7.0 + seedAngle * 2.3);
          float haloFalloff = exp(-distanceFromCenter * 18.0 / wobble);
          intensity += haloFalloff * brightnessExcess * 0.75;
        }
      }

      // Bright cores blow out toward white — like a real saturated sensor.
      vec3 finalColor = vColor + max(intensity - 1.0, 0.0) * vec3(0.6);
      // Alpha tracks emitted light. Where the sprite is dark, alpha is ~0
      // so the page's nebula gradient shines through instead of being
      // occluded by a black disc.
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
        // Pure additive (One * src + One * dst) on BOTH RGB and alpha so we
        // never multiply colour by alpha (premultiplied flow) and never punch
        // an opaque hole through the transparent canvas. Alpha accumulates
        // with brightness — dim sprite edges leave the page background
        // visible, bright cores saturate the framebuffer alpha.
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
    points.name = 'memory-atlas/starfield';

    function update(elapsedSeconds: number) {
        material.uniforms['uTime']!.value = elapsedSeconds;
    }

    function dispose() {
        geometry.dispose();
        material.dispose();
    }

    return { object: points, update, dispose };
}
