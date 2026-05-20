import {
    ACESFilmicToneMapping,
    AmbientLight,
    Color,
    Mesh,
    MeshStandardMaterial,
    PerspectiveCamera,
    PointLight,
    Scene,
    SphereGeometry,
    SRGBColorSpace,
    Vector3,
    WebGLRenderer,
} from 'three';
import Stats from 'three/addons/libs/stats.module.js';
import { BloomEffect, EffectComposer, EffectPass, RenderPass } from 'postprocessing';
import gsap from 'gsap';
import { onBeforeUnmount, onMounted, shallowRef, type Ref } from 'vue';

import { useGlobeCamera } from '@/modules/Globe/composables/useGlobeCamera';
import { createAtmosphere } from '@/modules/Globe/services/Atmosphere';
import { createCosmicPhenomena } from '@/modules/Globe/services/CosmicPhenomena';
import { createStarfield } from '@/modules/Globe/services/Starfield';
import type { GlobeSceneHandle, GlobeSceneOptions } from '@/modules/Globe/types/globe.types';

/**
 * Boot the Globe stage. Single owner of the render loop.
 *
 * Composables and services this orchestrates internally:
 *   - useGlobeCamera        → custom inertia controller (drag / pinch / wheel)
 *   - createStarfield       → shader-driven 8k-star celestial sphere
 *   - postprocessing        → EffectComposer + bloom pass
 *   - gsap                  → cinematic intro tween from far orbit → viewing distance
 *   - stats.js              → dev-only FPS overlay
 *
 * Future composables (markers, raycaster, atmosphere shader) should take the
 * returned `globeSceneHandle` and register additional per-frame hooks through
 * a callback registry rather than spinning up their own RAF loops.
 */
export function useGlobeScene(canvasRef: Readonly<Ref<HTMLCanvasElement | null>>, options: GlobeSceneOptions = {}) {
    const { radius = 1, segments = 64, showStats = import.meta.env.DEV, bloom = true } = options;

    const globeSceneHandle = shallowRef<GlobeSceneHandle | null>(null);

    let animationFrameId = 0;
    let lastFrameTime = 0;
    let elapsedSeconds = 0;
    let resizeObserver: ResizeObserver | null = null;

    // Refs captured at mount, consumed by renderFrame() and handleResize().
    let effectComposer: EffectComposer | null = null;
    let cameraController: ReturnType<typeof useGlobeCamera> | null = null;
    let starfieldUpdate: ((elapsedSeconds: number) => void) | null = null;
    let cosmicPhenomenaUpdate: ((elapsedSeconds: number, deltaSeconds: number) => void) | null = null;
    let fpsStats: Stats | null = null;

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
        effectComposer.render(deltaSeconds);
        fpsStats?.end();

        animationFrameId = requestAnimationFrame(renderFrame);
    }

    function disposeScene() {
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        animationFrameId = 0;
        lastFrameTime = 0;
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
    }

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

        // ── Scene & camera ────────────────────────────────────────────────
        const scene = new Scene();
        // Opaque deep-space background. The canvas is alpha:true so the
        // CSS nebula gradient sits behind it, but we still need an opaque
        // scene fill — otherwise the globe inherits the transparent canvas
        // alpha through the bloom pass and reads as see-through. The colour
        // matches `$color-deep-space` so the seam against the CSS gradient
        // is invisible.
        scene.background = new Color('#060914');
        const camera = new PerspectiveCamera(45, 1, 0.1, 200);

        // ── Globe (placeholder material until textures arrive) ───────────
        const globeGeometry = new SphereGeometry(radius, segments, segments);
        const globeMaterial = new MeshStandardMaterial({
            color: new Color('#1d3b8a'),
            roughness: 0.75,
            metalness: 0.05,
            // Small emissive so bloom has something to grab onto pre-textures.
            emissive: new Color('#0a1740'),
            emissiveIntensity: 0.4,
        });
        const globe = new Mesh(globeGeometry, globeMaterial);
        scene.add(globe);

        // ── Lights ────────────────────────────────────────────────────────
        const sunLight = new PointLight(0xfff3d6, 2.8, 0, 0);
        sunLight.position.set(5, 3, 5);
        scene.add(sunLight);
        const ambientLight = new AmbientLight(0x4a5680, 0.35);
        scene.add(ambientLight);

        // ── Atmosphere (Fresnel rim glow + terminator highlight) ─────────
        // Shares the sun direction with the PointLight above so the day side
        // glows hot blue-white and the night side keeps a faint cyan whisper.
        const atmosphere = createAtmosphere({
            planetRadius: radius,
            scale: 1.04,
            color: '#5aa9ff',
            nightColor: '#0a1a3a',
            fresnelPower: 6.0,
            intensity: 1.2,
            sunDirection: new Vector3(5, 3, 5).normalize(),
        });
        scene.add(atmosphere.object);

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

        // ── Postprocessing ────────────────────────────────────────────────
        const composer = new EffectComposer(renderer);
        composer.addPass(new RenderPass(scene, camera));

        let bloomEffect: BloomEffect | null = null;
        if (bloom) {
            // Threshold sits between dim background stars and our hero phenomena,
            // so only white dwarfs / pulsar peaks / supernova flashes actually bloom.
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
        const controller = useGlobeCamera(camera, canvas, { initialRadius: 3.2 });

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

        animationFrameId = requestAnimationFrame(renderFrame);
    });

    onBeforeUnmount(disposeScene);

    return { globeSceneHandle };
}
