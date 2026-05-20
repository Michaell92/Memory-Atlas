import { AdditiveBlending, BackSide, Color, Mesh, ShaderMaterial, SphereGeometry, Vector3 } from 'three';

import type { AtmosphereHandle, AtmosphereOptions } from '@/modules/Globe/types/globe.types';

/**
 * Cinematic planetary atmosphere — a softly glowing halo wrapping the globe.
 *
 * Implementation:
 *   - A second sphere slightly larger than the planet (typically 1.12×–1.18×).
 *   - Rendered with `side: BackSide` so we shade the *inner* surface of the
 *     shell from the camera's perspective. Combined with a Fresnel term this
 *     produces a clean atmospheric limb that wraps the planet without ever
 *     occluding the front-face detail.
 *   - `AdditiveBlending` + `depthWrite: false` so it never punches holes in
 *     the scene and never gets re-occluded by anything behind it.
 *
 * Shader:
 *   - Fresnel: pow(1 - dot(normal, viewDir), exponent) — concentrates light
 *     at the limb where the atmosphere is physically thickest.
 *   - Sun term: dot(normal, sunDirection) shifts the glow toward the day
 *     side so the lit hemisphere has a brighter, hotter rim while the night
 *     side keeps a faint cyan whisper. This is the magic-hour planetary look.
 *
 * Bloom will catch the brightest pixels at the limb and bloom the halo
 * outward, so we keep the shader output deliberately tight — the rim's
 * apparent thickness comes from the bloom radius, not from a fat falloff.
 */
export function createAtmosphere(options: AtmosphereOptions = {}): AtmosphereHandle {
    const {
        planetRadius = 1,
        scale = 1.15,
        color = '#5aa9ff',
        nightColor = '#0a2540',
        fresnelPower = 3.2,
        intensity = 1.4,
        sunDirection = new Vector3(5, 3, 5).normalize(),
    } = options;

    const geometry = new SphereGeometry(planetRadius * scale, 96, 96);

    const material = new ShaderMaterial({
        uniforms: {
            uDayColor: { value: new Color(color) },
            uNightColor: { value: new Color(nightColor) },
            uFresnelPower: { value: fresnelPower },
            uIntensity: { value: intensity },
            uSunDirection: { value: sunDirection.clone() },
        },
        vertexShader: /* glsl */ `
            varying vec3 vWorldNormal;
            varying vec3 vWorldPosition;

            void main() {
                // Use the geometric normal in world space so the Fresnel term
                // and sun term are both stable across camera motion.
                vWorldNormal = normalize(mat3(modelMatrix) * normal);
                vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                vWorldPosition = worldPosition.xyz;
                gl_Position = projectionMatrix * viewMatrix * worldPosition;
            }
        `,
        fragmentShader: /* glsl */ `
            uniform vec3 uDayColor;
            uniform vec3 uNightColor;
            uniform float uFresnelPower;
            uniform float uIntensity;
            uniform vec3 uSunDirection;

            varying vec3 vWorldNormal;
            varying vec3 vWorldPosition;

            void main() {
                // We're on the BackSide of the shell, so flip the normal to
                // recover the outward-facing direction the user perceives.
                vec3 normal = -normalize(vWorldNormal);
                vec3 viewDirection = normalize(cameraPosition - vWorldPosition);

                // Rim band: tight Fresnel peak, multiplied by a soft falloff
                // toward the silhouette so the outermost pixels fade to zero.
                // Without this term the shell's hard ellipse edge is visible
                // as a crisp ring; with it, the brightest band sits just
                // inside the silhouette and bloom carries a soft halo outward.
                float facing = clamp(dot(normal, viewDirection), 0.0, 1.0);
                float fresnel = pow(1.0 - facing, uFresnelPower);
                float edgeTaper = pow(facing, 0.35);
                float rim = fresnel * edgeTaper;

                // Sun term: 0 on night side, 1 on day side, smooth at terminator.
                float sunFacing = dot(normal, normalize(uSunDirection));
                float dayWeight = smoothstep(-0.25, 0.4, sunFacing);

                vec3 rimColor = mix(uNightColor, uDayColor, dayWeight);

                // Slight extra punch right at the terminator — the sweet hot
                // sliver of light that sells the "planet at sunrise" feeling.
                float terminator = exp(-pow(sunFacing * 4.0, 2.0)) * 0.6;
                rimColor += uDayColor * terminator * dayWeight;

                float alpha = rim * uIntensity;
                gl_FragColor = vec4(rimColor * alpha, alpha);
            }
        `,
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
        side: BackSide,
    });

    const mesh = new Mesh(geometry, material);
    // Render after the opaque globe so the additive halo composites on top
    // of the planet edges without depth-fighting at the limb.
    mesh.renderOrder = 1;

    return {
        object: mesh,
        setSunDirection: (direction: Vector3) => {
            (material.uniforms['uSunDirection']!.value as Vector3).copy(direction).normalize();
        },
        dispose: () => {
            geometry.dispose();
            material.dispose();
        },
    };
}
