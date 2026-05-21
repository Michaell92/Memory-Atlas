import {
    ACESFilmicToneMapping,
    AmbientLight,
    Color,
    DirectionalLight,
    Mesh,
    MeshStandardMaterial,
    PerspectiveCamera,
    Scene,
    ShaderMaterial,
    SphereGeometry,
    SRGBColorSpace,
    Vector3,
    WebGLRenderer,
} from 'three';
import Stats from 'three/addons/libs/stats.module.js';
import { BloomEffect, EffectComposer, EffectPass, RenderPass } from 'postprocessing';
import gsap from 'gsap';
import { onBeforeUnmount, onMounted, ref, shallowRef, watch, type Ref } from 'vue';

import { useGlobeCamera } from '@/modules/Globe/composables/useGlobeCamera';
import { createAtmosphere } from '@/modules/Globe/services/Atmosphere';
import { createCountryMeshes } from '@/modules/Globe/services/CountryMeshes';
import { createCountrySymbols } from '@/modules/Globe/services/CountrySymbols';
import { createCosmicPhenomena } from '@/modules/Globe/services/CosmicPhenomena';
import { createEarthTexture } from '@/modules/Globe/services/EarthTexture';
import { createShootingStars } from '@/modules/Globe/services/ShootingStars';
import { createStarfield } from '@/modules/Globe/services/Starfield';
import { useUserStore } from '@/modules/User/stores/userStore';
import type { UserThemePalette } from '@/modules/User/types/user.types';
import type {
    CountryMeshesHandle,
    CountrySymbolsHandle,
    EarthTextureHandle,
    GlobeSceneHandle,
    GlobeSceneOptions,
    ShootingStarsHandle,
} from '@/modules/Globe/types/globe.types';

/**
 * Computes the normalised world-space direction from the globe centre toward
 * the real-world sun for the given date/time.
 *
 * Formula:
 *   - Solar declination: the latitude (±23.45°) where the sun is directly
 *     overhead, driven by Earth's axial tilt across the year.
 *   - Subsolar longitude: at UTC 12:00 the sub-solar point is at 0° (Greenwich);
 *     each UTC hour shifts it 15° westward.
 *   - Result is converted directly into the project's world-space lat/lng convention:
 *       x = cos(lat)·sin(lng),  y = sin(lat),  z = cos(lat)·cos(lng)
 */
function computeRealTimeSunDirection(date: Date): Vector3 {
    const startOfYear = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    const dayOfYear = Math.floor((date.getTime() - startOfYear.getTime()) / 86_400_000) + 1;

    // Approximate solar declination in radians.
    const declinationRad = -23.45 * Math.cos(((2 * Math.PI) / 365) * (dayOfYear + 10)) * (Math.PI / 180);

    // Subsolar longitude: solar noon is at 0° when it's 12:00 UTC.
    const utcFractionalHours = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
    const subsolarLngRad = (12 - utcFractionalHours) * 15 * (Math.PI / 180);

    return new Vector3(
        Math.cos(declinationRad) * Math.sin(subsolarLngRad),
        Math.sin(declinationRad),
        Math.cos(declinationRad) * Math.cos(subsolarLngRad),
    );
}

const SUN_DISTANCE = 100;

export function useGlobeScene(canvasRef: Readonly<Ref<HTMLCanvasElement | null>>, options: GlobeSceneOptions = {}) {
    const { radius = 1, segments = 64, showStats = import.meta.env.DEV, bloom = true } = options;
    const userStore = useUserStore();

    const globeSceneHandle = shallowRef<GlobeSceneHandle | null>(null);
    const isEarthReady = ref(false);

    let animationFrameId = 0;
    let lastFrameTime = 0;
    let elapsedSeconds = 0;
    let resizeObserver: ResizeObserver | null = null;

    // Refs captured at mount, consumed by renderFrame() and handleResize().
    let effectComposer: EffectComposer | null = null;
    let cameraController: ReturnType<typeof useGlobeCamera> | null = null;
    let starfieldUpdate: ((elapsedSeconds: number) => void) | null = null;
    let cosmicPhenomenaUpdate: ((elapsedSeconds: number, deltaSeconds: number) => void) | null = null;
    let shootingStarsUpdate: ((elapsedSeconds: number, deltaSeconds: number) => void) | null = null;
    let fpsStats: Stats | null = null;
    let sunSyncIntervalId: ReturnType<typeof setInterval> | null = null;
    let sceneRef: Scene | null = null;
    let rendererRef: WebGLRenderer | null = null;
    let globeMaterialRef: MeshStandardMaterial | null = null;
    let sunLightRef: DirectionalLight | null = null;
    let ambientLightRef: AmbientLight | null = null;
    let atmosphereMaterialRef: ShaderMaterial | null = null;

    function applyThemePalette(themePalette: UserThemePalette, brightness: number): void {
        if (!sceneRef || !globeMaterialRef || !sunLightRef || !ambientLightRef || !atmosphereMaterialRef) return;

        sceneRef.background = new Color(themePalette.globe.background);
        globeMaterialRef.color.set(themePalette.globe.globeColor);
        globeMaterialRef.emissive.set(themePalette.globe.globeEmissive);
        globeMaterialRef.needsUpdate = true;

        ambientLightRef.color.set(themePalette.globe.ambientLight);
        sunLightRef.color.set(themePalette.globe.sunLight);
        sunLightRef.intensity = 4.2 * brightness;

        atmosphereMaterialRef.uniforms['uDayColor']!.value.set(themePalette.globe.atmosphereColor);
        atmosphereMaterialRef.uniforms['uNightColor']!.value.set(themePalette.globe.atmosphereNightColor);

        if (rendererRef) {
            rendererRef.toneMappingExposure = 1.1 + (brightness - 1) * 0.18;
        }
    }

    function handleResize(canvas: HTMLCanvasElement) {
        const currentHandle = globeSceneHandle.value;
        if (!currentHandle) return;
        const { clientWidth: width, clientHeight: height } = canvas;
        if (width === 0 || height === 0) return;
        currentHandle.renderer.setSize(width, height, false);
        currentHandle.camera.aspect = width / height;
        currentHandle.camera.updateProjectionMatrix();
        effectComposer?.setSize(width, height);
    }

    function renderFrame(timestamp: number) {
        if (!globeSceneHandle.value || !effectComposer || !cameraController) return;

        // Clamp delta so a tabbed-out pause doesn't fling the camera on resume.
        const deltaSeconds = lastFrameTime === 0 ? 0 : Math.min((timestamp - lastFrameTime) / 1000, 0.1);
        lastFrameTime = timestamp;
        elapsedSeconds += deltaSeconds;

        fpsStats?.begin();
        cameraController.update(deltaSeconds);
        starfieldUpdate?.(elapsedSeconds);
        cosmicPhenomenaUpdate?.(elapsedSeconds, deltaSeconds);
        shootingStarsUpdate?.(elapsedSeconds, deltaSeconds);
        effectComposer.render(deltaSeconds);
        fpsStats?.end();

        animationFrameId = requestAnimationFrame(renderFrame);
    }

    function startRenderLoop(): void {
        if (animationFrameId !== 0) return;
        animationFrameId = requestAnimationFrame(renderFrame);
    }

    function stopRenderLoop(): void {
        if (animationFrameId !== 0) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = 0;
        }
        lastFrameTime = 0;
    }

    function disposeScene() {
        stopRenderLoop();
        elapsedSeconds = 0;
        resizeObserver?.disconnect();
        resizeObserver = null;
        globeSceneHandle.value?.dispose();
        globeSceneHandle.value = null;
        effectComposer = null;
        cameraController = null;
        starfieldUpdate = null;
        cosmicPhenomenaUpdate = null;
        fpsStats = null;
        shootingStarsUpdate = null;
        if (sunSyncIntervalId !== null) {
            clearInterval(sunSyncIntervalId);
            sunSyncIntervalId = null;
        }
        sceneRef = null;
        rendererRef = null;
        globeMaterialRef = null;
        sunLightRef = null;
        ambientLightRef = null;
        atmosphereMaterialRef = null;
    }

    watch(
        [() => userStore.currentThemePalette, () => userStore.currentBrightness],
        ([themePalette, brightness]) => {
            applyThemePalette(themePalette, brightness);
        },
        { immediate: true },
    );

    onMounted(() => {
        const canvas = canvasRef.value;
        if (!canvas) return;

        // ── Renderer ──────────────────────────────────────────────────────
        const renderer = new WebGLRenderer({
            canvas,
            antialias: false, // bloom pass owns AA via SMAA later; cheaper this way
            alpha: false,
            powerPreference: 'high-performance',
            stencil: false,
            depth: true,
        });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.outputColorSpace = SRGBColorSpace;
        renderer.toneMapping = ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.1;
        rendererRef = renderer;

        // ── Scene & camera ────────────────────────────────────────────────
        const scene = new Scene();
        scene.background = new Color(userStore.currentThemePalette.globe.background);
        sceneRef = scene;
        const camera = new PerspectiveCamera(45, 1, 0.001, 200);

        // ── Globe ──────────────────────────────────────────────────────────────
        const sunDirectionWorld = computeRealTimeSunDirection(new Date());

        const globeGeometry = new SphereGeometry(radius, segments, segments);
        const globeMaterial = new MeshStandardMaterial({
            color: new Color(userStore.currentThemePalette.globe.globeColor),
            emissive: new Color(userStore.currentThemePalette.globe.globeEmissive),
            emissiveIntensity: 0.45,
            roughness: 0.75,
            metalness: 0.0,
        });
        globeMaterialRef = globeMaterial;

        globeMaterial.onBeforeCompile = (shader) => {
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

        const globe = new Mesh(globeGeometry, globeMaterial);
        // SphereGeometry's UVs put the seam at x=0; rotate the mesh so the
        // Atlantic (lng 0) sits at the front of the scene by default.
        globe.rotation.y = -Math.PI / 2;
        scene.add(globe);

        let countryMeshes: CountryMeshesHandle | null = null;
        let countrySymbols: CountrySymbolsHandle | null = null;

        // Build the country layer as 3D vector geometry — stays crisp at any
        // zoom level. The base sphere underneath supplies the ocean color.
        createCountryMeshes({ globeRadius: radius, resolution: '50m' })
            .then((meshesHandle) => {
                countryMeshes = meshesHandle;
                scene.add(meshesHandle.object);
                isEarthReady.value = true;

                createCountrySymbols({ globeRadius: radius, resolution: '50m' })
                    .then((symbolsHandle) => {
                        countrySymbols = symbolsHandle;
                        scene.add(symbolsHandle.object);
                    })
                    .catch((error) => {
                        console.error('[Globe] Failed to build country symbols', error);
                    });
            })
            .catch((error) => {
                console.error('[Globe] Failed to build country meshes', error);
            });

        // ── Lights ────────────────────────────────────────────────────────
        const sunLight = new DirectionalLight(
            userStore.currentThemePalette.globe.sunLight,
            4.2 * userStore.currentBrightness,
        );
        sunLight.position.copy(sunDirectionWorld).multiplyScalar(SUN_DISTANCE);
        sunLight.target.position.set(0, 0, 0);
        scene.add(sunLight);
        scene.add(sunLight.target);
        sunLightRef = sunLight;
        const ambientLight = new AmbientLight(userStore.currentThemePalette.globe.ambientLight, 0.28);
        scene.add(ambientLight);
        ambientLightRef = ambientLight;

        // ── Atmosphere (Fresnel rim glow + terminator highlight) ─────────
        const atmosphere = createAtmosphere({
            planetRadius: radius,
            scale: 1.04,
            color: userStore.currentThemePalette.globe.atmosphereColor,
            nightColor: userStore.currentThemePalette.globe.atmosphereNightColor,
            fresnelPower: 6.0,
            intensity: 1.2,
            sunDirection: sunDirectionWorld,
        });
        scene.add(atmosphere.object);
        atmosphereMaterialRef = atmosphere.object.material as ShaderMaterial;

        // ── Real-time sun position ────────────────────────────────────────────
        const atmosphereSunUniform = (atmosphere.object.material as ShaderMaterial).uniforms['uSunDirection']!
            .value as Vector3;

        function updateSunPosition(): void {
            const sunDir = computeRealTimeSunDirection(new Date());
            sunDirectionWorld.copy(sunDir);
            sunLight.position.copy(sunDir).multiplyScalar(SUN_DISTANCE);
            sunLight.target.updateMatrixWorld();
            atmosphereSunUniform.copy(sunDir);
        }

        updateSunPosition();
        sunSyncIntervalId = setInterval(updateSunPosition, 60_000);
        applyThemePalette(userStore.currentThemePalette, userStore.currentBrightness);

        // ── Starfield ─────────────────────────────────────────────────────
        const starfield = createStarfield({
            uniformStarCount: 6000,
            galacticBandStarCount: 2000,
            radius: 80,
            galacticTilt: 0.4,
        });
        scene.add(starfield.object);
        starfieldUpdate = starfield.update;

        // ── Cosmic phenomena (white dwarfs, pulsar, binary, supernova) ───────
        const cosmicPhenomena = createCosmicPhenomena({
            whiteDwarfCount: 8,
            redGiantCount: 0,
            pulsarCount: 2,
            binarySystemCount: 3,
            supernovaIntervalSeconds: 28,
            radius: 70,
        });
        scene.add(cosmicPhenomena.object);
        cosmicPhenomenaUpdate = cosmicPhenomena.update;

        // ── Shooting stars ────────────────────────────────────────────────
        const shootingStars = createShootingStars(camera, { radius: 76 });
        scene.add(shootingStars.object);
        shootingStarsUpdate = shootingStars.update;

        // ── Postprocessing ────────────────────────────────────────────────
        const composer = new EffectComposer(renderer);
        composer.addPass(new RenderPass(scene, camera));

        let bloomEffect: BloomEffect | null = null;
        if (bloom) {
            bloomEffect = new BloomEffect({
                intensity: 0.9,
                luminanceThreshold: 0.55,
                luminanceSmoothing: 0.35,
                mipmapBlur: true,
                radius: 0.75,
            });
            composer.addPass(new EffectPass(camera, bloomEffect));
        }

        // ── Custom camera controller ──────────────────────────────────────
        const controller = useGlobeCamera(camera, canvas, { initialRadius: 3.2, minRadius: 1.005 });

        // ── Dev FPS overlay ───────────────────────────────────────────────
        let stats: Stats | null = null;
        if (showStats) {
            stats = new Stats();
            stats.dom.style.position = 'absolute';
            stats.dom.style.top = '0.5rem';
            stats.dom.style.left = '0.5rem';
            stats.dom.style.zIndex = '100';
            canvas.parentElement?.appendChild(stats.dom);
        }

        // ── Cinematic intro: drift in from far orbit ─────────────────────
        controller.flyTo(8, 0, Math.PI / 2);
        controller.setAutoRotate(false);
        const introTween = gsap.to(controller.spherical, {
            radius: 3.2,
            duration: 2.4,
            ease: 'expo.out',
            onComplete: () => controller.setAutoRotate(true),
        });

        effectComposer = composer;
        cameraController = controller;
        fpsStats = stats;

        globeSceneHandle.value = {
            scene,
            camera,
            renderer,
            globe,
            dispose: () => {
                introTween.kill();
                controller.dispose();
                starfield.dispose();
                cosmicPhenomena.dispose();
                atmosphere.dispose();
                shootingStars.dispose();
                countryMeshes?.dispose();
                countrySymbols?.dispose();
                composer.dispose();
                bloomEffect?.dispose();
                globeGeometry.dispose();
                globeMaterial.dispose();
                renderer.dispose();
                stats?.dom.remove();
            },
        };

        handleResize(canvas);
        resizeObserver = new ResizeObserver(() => handleResize(canvas));
        resizeObserver.observe(canvas);

        startRenderLoop();
    });

    onBeforeUnmount(disposeScene);

    return { globeSceneHandle, isEarthReady };
}
