import {
    AdditiveBlending,
    BufferGeometry,
    CanvasTexture,
    Float32BufferAttribute,
    Points,
    PointsMaterial,
    Raycaster,
    Sprite,
    SpriteMaterial,
    Vector2,
    Vector3,
} from 'three';
import { onBeforeUnmount, onMounted, watch, type Ref } from 'vue';

import { latLngTo3D } from '@/modules/Globe/utils/latLngTo3D';
import type { GlobeSceneHandle } from '@/modules/Globe/types/globe.types';
import type { City } from '@/shared/types/city.types';

/**
 * Renders cached cities as glowing cyan dots (Points) + floating text
 * labels (Sprite) on the globe surface.
 *
 * Dots  — one Points draw call with sizeAttenuation:false so dots stay a
 *          constant screen-space pixel size at every zoom level. A radial-
 *          gradient canvas texture with AdditiveBlending creates the glow halo.
 * Labels — one Sprite per city; canvas-rendered text, billboarded, depth-tested
 *           against the globe so back-side labels are naturally occluded.
 *
 * LOD decluttering — GeoNames returns cities sorted by population (highest
 * first). We show only the top-N city labels at each zoom level, keeping the
 * globe readable. The LOD level is re-evaluated every 200 ms as the camera
 * moves.
 */

// ── Dot constants ─────────────────────────────────────────────────────────────

/** Globe-space radius at which accent dots sit — just above the surface. */
const MARKER_SURFACE_RADIUS = 1.004;

/**
 * Dot size in screen-space pixels (sizeAttenuation is off).
 * The texture canvas is wider than the core so the glow halo renders outside
 * this pixel budget — the perceived glow will be larger than 10 px.
 */
const MARKER_DOT_SIZE_PX = 10;

// ── Label constants ───────────────────────────────────────────────────────────

/** Globe-space radius at which label sprites float — slightly above the dots. */
const LABEL_SURFACE_RADIUS = 1.016;

/** Canvas height (px) used when drawing label text. Width adapts to text. */
const LABEL_CANVAS_HEIGHT = 32;

/** Font spec that matches the canvas height above. */
const LABEL_FONT = `bold ${Math.round(LABEL_CANVAS_HEIGHT * 0.65)}px system-ui, -apple-system, sans-serif`;

/** Text colour — matches the dot accent and blooms. */
const LABEL_TEXT_COLOR = '#7ef7c0';

/**
 * Screen-space height of each label sprite (sizeAttenuation is off).
 * In Three.js non-attenuated mode, 1.0 = full viewport height.
 * 0.028 ≈ ~22 px on a typical 800 px tall viewport — compact but legible.
 */
const LABEL_SCALE_HEIGHT = 0.028;

/** How often (ms) to poll camera radius and refresh LOD visibility. */
const LOD_POLL_INTERVAL_MS = 200;

// ── LOD table ─────────────────────────────────────────────────────────────────

/**
 * How many city labels to show at each zoom tier, keyed by the minimum camera
 * radius that activates the tier. Checked in descending order (farthest first);
 * the first match wins.
 *
 * Because GeoNames returns cities sorted by population, the first N entries in
 * `cachedCities` are always the globally most significant cities at that zoom.
 */
interface LabelLodConfig {
    readonly minCameraRadius: number;
    readonly maxVisibleLabels: number;
}

const LABEL_LOD_CONFIGS: readonly LabelLodConfig[] = [
    { minCameraRadius: 3.5, maxVisibleLabels: 10 }, // world overview — capitals only
    { minCameraRadius: 2.5, maxVisibleLabels: 25 }, // continental
    { minCameraRadius: 2.0, maxVisibleLabels: 50 }, // regional
    { minCameraRadius: 1.7, maxVisibleLabels: 80 }, // country-level
    { minCameraRadius: 0, maxVisibleLabels: 250 }, // city-level (zoomed in close)
];

function resolveMaxVisibleLabels(cameraRadius: number): number {
    for (const config of LABEL_LOD_CONFIGS) {
        if (cameraRadius >= config.minCameraRadius) return config.maxVisibleLabels;
    }
    return LABEL_LOD_CONFIGS[LABEL_LOD_CONFIGS.length - 1]!.maxVisibleLabels;
}

// ── Dot texture factory ───────────────────────────────────────────────────────

/**
 * Builds a radial-gradient CanvasTexture for use with PointsMaterial.
 * The gradient goes from a bright white-cyan core to a transparent cyan edge,
 * giving each point a sharp centre and a wide soft glow halo.
 * AdditiveBlending on the material makes overlapping halos accumulate naturally.
 */
function createDotGlowTexture(): CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const context = canvas.getContext('2d')!;
    const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0.0, 'rgba(255, 255, 255, 1.00)'); // bright white core
    gradient.addColorStop(0.15, 'rgba(126, 247, 192, 1.00)'); // cyan inner glow
    gradient.addColorStop(0.45, 'rgba(126, 247, 192, 0.35)'); // glow falloff
    gradient.addColorStop(1.0, 'rgba(126, 247, 192, 0.00)'); // transparent edge
    context.fillStyle = gradient;
    context.fillRect(0, 0, 64, 64);
    return new CanvasTexture(canvas);
}

// ── Sprite factory ────────────────────────────────────────────────────────────

/**
 * Creates a billboard Sprite whose texture is the city name rendered onto a
 * tight canvas. Caller is responsible for calling disposeLabelSprite() when done.
 */
function createCityLabelSprite(cityName: string): Sprite {
    // Measure the text so the canvas is exactly as wide as needed.
    const measureCanvas = document.createElement('canvas');
    const measureContext = measureCanvas.getContext('2d')!;
    measureContext.font = LABEL_FONT;
    const measuredWidth = Math.ceil(measureContext.measureText(cityName).width);

    const labelCanvas = document.createElement('canvas');
    labelCanvas.width = measuredWidth + 16; // horizontal padding
    labelCanvas.height = LABEL_CANVAS_HEIGHT;

    const labelContext = labelCanvas.getContext('2d')!;
    labelContext.font = LABEL_FONT;
    labelContext.fillStyle = LABEL_TEXT_COLOR;
    labelContext.textAlign = 'center';
    labelContext.textBaseline = 'middle';
    labelContext.fillText(cityName, labelCanvas.width / 2, labelCanvas.height / 2);

    const labelTexture = new CanvasTexture(labelCanvas);
    const labelMaterial = new SpriteMaterial({
        map: labelTexture,
        transparent: true,
        depthTest: false, // never clipped by the globe surface — back-face culling done in JS
        depthWrite: false,
        sizeAttenuation: false, // constant screen-space size — never grows on zoom-in
    });

    const labelSprite = new Sprite(labelMaterial);
    labelSprite.renderOrder = 2; // render after opaque globe, depthTest off so always on top
    const aspectRatio = labelCanvas.width / labelCanvas.height;
    labelSprite.scale.set(aspectRatio * LABEL_SCALE_HEIGHT, LABEL_SCALE_HEIGHT, 1.0);

    return labelSprite;
}

function disposeLabelSprite(labelSprite: Sprite): void {
    const labelMaterial = labelSprite.material as SpriteMaterial;
    labelMaterial.map?.dispose();
    labelMaterial.dispose();
}

// ── Composable ────────────────────────────────────────────────────────────────

export function useGlobeCityMarkers(
    globeSceneHandleRef: Readonly<Ref<GlobeSceneHandle | null>>,
    cachedCitiesRef: Readonly<Ref<readonly City[]>>,
    canvasRef: Readonly<Ref<HTMLCanvasElement | null>>,
): { getIntersectedCity: (raycaster: Raycaster) => City | null } {
    // ── Dot points state ──────────────────────────────────────────────────────
    // One Points object covers all cities in a single draw call.
    // dotGlowTexture is created once and shared across Points recreations.
    let dotPoints: Points | null = null;
    let dotGlowTexture: CanvasTexture | null = null;
    let dotPositionsCapacity = 0;

    // ── Label sprite state ────────────────────────────────────────────────────
    // Map from city.id → Sprite. Cache is append-only so we only create each once.
    const cityLabelSprites = new Map<string, Sprite>();
    // Reverse map for O(1) city lookup when a raycaster hit returns a Sprite.
    const spriteToCity = new Map<Sprite, City>();
    // Surface normal (unit vector) per city — used for back-face culling.
    const cityNormals = new Map<string, Vector3>();
    let lodPollIntervalId: ReturnType<typeof setInterval> | null = null;

    // Reusable raycaster + NDC vector for the hover cursor check (mousemove path).
    const hoverRaycaster = new Raycaster();
    const hoverNdc = new Vector2();

    // ── Dot points lifecycle ──────────────────────────────────────────────────

    function createDotPoints(capacity: number): Points {
        if (!dotGlowTexture) dotGlowTexture = createDotGlowTexture();

        const dotGeometry = new BufferGeometry();
        const positionsArray = new Float32Array(capacity * 3);
        dotGeometry.setAttribute('position', new Float32BufferAttribute(positionsArray, 3));
        dotGeometry.setDrawRange(0, 0);

        const dotMaterial = new PointsMaterial({
            color: 0xffffff, // white so the texture's cyan renders unmodified
            size: MARKER_DOT_SIZE_PX,
            map: dotGlowTexture,
            sizeAttenuation: false, // constant pixel size — never grows on zoom-in
            transparent: true,
            depthTest: true,
            depthWrite: false,
            blending: AdditiveBlending,
        });

        const dotPointsObject = new Points(dotGeometry, dotMaterial);
        dotPointsObject.frustumCulled = false;
        return dotPointsObject;
    }

    function destroyDotPoints(): void {
        if (!dotPoints) return;
        globeSceneHandleRef.value?.scene.remove(dotPoints);
        dotPoints.geometry.dispose();
        (dotPoints.material as PointsMaterial).dispose();
        // dotGlowTexture is NOT disposed here — it is reused across recreations.
        dotPoints = null;
        dotPositionsCapacity = 0;
    }

    // ── Label sprite lifecycle ────────────────────────────────────────────────

    function destroyAllLabelSprites(): void {
        const sceneHandle = globeSceneHandleRef.value;
        for (const labelSprite of cityLabelSprites.values()) {
            sceneHandle?.scene.remove(labelSprite);
            disposeLabelSprite(labelSprite);
        }
        cityLabelSprites.clear();
        spriteToCity.clear();
        cityNormals.clear();
    }

    // ── LOD visibility ────────────────────────────────────────────────────────

    function applyLodVisibility(cities: readonly City[], maxVisibleLabels: number): void {
        const cameraPosition = globeSceneHandleRef.value?.camera.position;

        for (let cityIndex = 0; cityIndex < cities.length; cityIndex++) {
            const city = cities[cityIndex]!;
            const labelSprite = cityLabelSprites.get(city.id);
            if (!labelSprite) continue;

            // LOD: only show top-N cities by population rank.
            const withinLod = cityIndex < maxVisibleLabels;

            // Back-face cull: hide cities on the far side of the globe.
            // A city's surface normal dot-product with the camera position
            // is positive when the city faces the camera side of the globe.
            // Threshold > 0 adds a limb margin to avoid flicker at the edge.
            const cityNormal = cityNormals.get(city.id);
            const isFacingCamera = cameraPosition && cityNormal ? cityNormal.dot(cameraPosition) > 0.1 : true;

            labelSprite.visible = withinLod && isFacingCamera;
        }
    }

    function pollLodVisibility(): void {
        const camera = globeSceneHandleRef.value?.camera;
        if (!camera) return;
        const cameraRadius = camera.position.length();
        applyLodVisibility(cachedCitiesRef.value, resolveMaxVisibleLabels(cameraRadius));
    }

    // ── Full update ───────────────────────────────────────────────────────────

    function updateMarkersAndLabels(cities: readonly City[]): void {
        const sceneHandle = globeSceneHandleRef.value;
        if (!sceneHandle) return;

        // Dots ─────────────────────────────────────────────────────────────────
        if (!dotPoints || cities.length > dotPositionsCapacity) {
            destroyDotPoints();
            dotPositionsCapacity = Math.ceil(cities.length * 1.5);
            dotPoints = createDotPoints(dotPositionsCapacity);
            sceneHandle.scene.add(dotPoints);
        }

        const positionAttribute = dotPoints.geometry.attributes['position']!;
        const positionsArray = positionAttribute.array as Float32Array;
        for (let cityIndex = 0; cityIndex < cities.length; cityIndex++) {
            const city = cities[cityIndex]!;
            const dotPosition = latLngTo3D(city.lat, city.lng, MARKER_SURFACE_RADIUS);
            positionsArray[cityIndex * 3] = dotPosition.x;
            positionsArray[cityIndex * 3 + 1] = dotPosition.y;
            positionsArray[cityIndex * 3 + 2] = dotPosition.z;
        }
        positionAttribute.needsUpdate = true;
        dotPoints.geometry.setDrawRange(0, cities.length);

        // Labels ───────────────────────────────────────────────────────────────
        // Only create sprites for cities not yet in the map. Because the tile
        // cache is append-only, existing sprites are simply reused.
        for (let cityIndex = 0; cityIndex < cities.length; cityIndex++) {
            const city = cities[cityIndex]!;
            if (cityLabelSprites.has(city.id)) continue;

            const labelSprite = createCityLabelSprite(city.name);
            const labelPosition = latLngTo3D(city.lat, city.lng, LABEL_SURFACE_RADIUS);
            labelSprite.position.set(labelPosition.x, labelPosition.y, labelPosition.z);
            labelSprite.visible = false; // LOD poll will reveal the correct subset

            cityLabelSprites.set(city.id, labelSprite);
            spriteToCity.set(labelSprite, city);
            // Pre-compute the city's globe surface normal for back-face culling.
            cityNormals.set(city.id, latLngTo3D(city.lat, city.lng, 1.0));
            sceneHandle.scene.add(labelSprite);
        }

        // Force a LOD re-evaluation so newly added sprites appear immediately.
        pollLodVisibility();
    }

    // ── City intersection (exact sprite hit test) ─────────────────────────────

    /**
     * Returns the City whose label sprite the given raycaster currently
     * intersects, or null if none. Only visible (LOD-shown) sprites are tested.
     *
     * IMPORTANT: the caller must have already called
     * `raycaster.setFromCamera(ndcPointer, camera)` before calling this.
     * `raycaster.camera` is set here automatically (required for sprites with
     * sizeAttenuation:false).
     */
    function getIntersectedCity(raycaster: Raycaster): City | null {
        const camera = globeSceneHandleRef.value?.camera;
        if (!camera) return null;

        // Three.js requires raycaster.camera for sizeAttenuation:false sprites.
        raycaster.camera = camera;

        const visibleSprites: Sprite[] = [];
        for (const labelSprite of cityLabelSprites.values()) {
            if (labelSprite.visible) visibleSprites.push(labelSprite);
        }
        if (visibleSprites.length === 0) return null;

        const intersections = raycaster.intersectObjects(visibleSprites, false);
        if (intersections.length === 0) return null;

        const hitSprite = intersections[0]!.object as Sprite;
        return spriteToCity.get(hitSprite) ?? null;
    }

    // ── Hover cursor ─────────────────────────────────────────────────────────

    function handlePointerMove(event: PointerEvent): void {
        const canvas = canvasRef.value;
        const camera = globeSceneHandleRef.value?.camera;
        if (!canvas || !camera) return;

        const { left, top, width, height } = canvas.getBoundingClientRect();
        hoverNdc.set(((event.clientX - left) / width) * 2 - 1, -((event.clientY - top) / height) * 2 + 1);
        hoverRaycaster.setFromCamera(hoverNdc, camera);

        const hoveredCity = getIntersectedCity(hoverRaycaster);
        canvas.style.cursor = hoveredCity ? 'pointer' : '';
    }

    // ── Watchers ──────────────────────────────────────────────────────────────

    watch(cachedCitiesRef, (updatedCities) => {
        updateMarkersAndLabels(updatedCities);
    });

    watch(globeSceneHandleRef, (newHandle) => {
        if (!newHandle) return;

        // Re-attach scene objects when the scene handle is (re)created.
        if (dotPoints) newHandle.scene.add(dotPoints);
        for (const labelSprite of cityLabelSprites.values()) {
            newHandle.scene.add(labelSprite);
        }

        // If cities were cached before the scene was ready, render them now.
        if (cachedCitiesRef.value.length > 0) {
            updateMarkersAndLabels(cachedCitiesRef.value);
        }
    });

    onMounted(() => {
        lodPollIntervalId = setInterval(pollLodVisibility, LOD_POLL_INTERVAL_MS);
        canvasRef.value?.addEventListener('pointermove', handlePointerMove);
    });

    onBeforeUnmount(() => {
        if (lodPollIntervalId !== null) clearInterval(lodPollIntervalId);
        canvasRef.value?.removeEventListener('pointermove', handlePointerMove);
        destroyDotPoints();
        dotGlowTexture?.dispose();
        dotGlowTexture = null;
        destroyAllLabelSprites();
    });

    return { getIntersectedCity };
}
