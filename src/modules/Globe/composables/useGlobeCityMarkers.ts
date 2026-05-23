import {
    AdditiveBlending,
    BufferGeometry,
    CanvasTexture,
    Float32BufferAttribute,
    Frustum,
    MathUtils,
    Matrix4,
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

/**
 * Globe-space radius at which label sprites float.
 * Keep this only slightly above the dot radius so labels feel anchored to the
 * marker instead of drifting with noticeable parallax during rotation.
 */
const LABEL_SURFACE_RADIUS = 1.001;

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

// ── LOD table ─────────────────────────────────────────────────────────────────

/**
 * LOD table — both dot count and label count rise as the camera zooms in.
 *
 * Why scope dots by LOD too?
 *   Allocating a Sprite + CanvasTexture per city for all 33k entries up front
 *   pins megabytes of GPU memory and crashes weak devices. The buffer is
 *   pre-sized for the deepest tier, but `setDrawRange` only exposes the
 *   current tier's slice. Sprites are created lazily as the tier grows and
 *   disposed when it shrinks, so memory tracks active visual density, not
 *   dataset size.
 *
 * Because cities are sorted by population at load time, slicing the top-N is
 * the same as showing the most globally significant cities at that zoom.
 */
interface CityLodConfig {
    readonly minCameraRadius: number;
    readonly maxDots: number;
    readonly maxLabels: number;
    readonly labelScaleHeight: number;
}

const CITY_LOD_CONFIGS: readonly CityLodConfig[] = [
    { minCameraRadius: 3.0, maxDots: 0, maxLabels: 0, labelScaleHeight: 0.02 }, // world overview
    { minCameraRadius: 2.6, maxDots: 50, maxLabels: 0, labelScaleHeight: 0.02 }, // continental
    { minCameraRadius: 1.9, maxDots: 200, maxLabels: 10, labelScaleHeight: 0.022 }, // regional
    { minCameraRadius: 1.45, maxDots: 400, maxLabels: 32, labelScaleHeight: 0.018 }, // country
    { minCameraRadius: 1.18, maxDots: 1000, maxLabels: 75, labelScaleHeight: 0.015 }, // close country
    { minCameraRadius: 0, maxDots: 2000, maxLabels: 140, labelScaleHeight: 0.013 }, // deepest city close-up
];

function resolveCityLod(cameraRadius: number): CityLodConfig {
    for (const config of CITY_LOD_CONFIGS) {
        if (cameraRadius >= config.minCameraRadius) return config;
    }
    return CITY_LOD_CONFIGS[CITY_LOD_CONFIGS.length - 1]!;
}

/**
 * Smoothly interpolates labelScaleHeight between adjacent LOD breakpoints so
 * scale never snaps to a new value as the camera crosses a threshold.
 */
function resolveCityLabelScaleHeight(cameraRadius: number): number {
    const configs = CITY_LOD_CONFIGS;
    if (cameraRadius >= configs[0]!.minCameraRadius) return configs[0]!.labelScaleHeight;
    const lastConfig = configs[configs.length - 1]!;
    if (cameraRadius <= lastConfig.minCameraRadius) return lastConfig.labelScaleHeight;

    for (let configIndex = 0; configIndex < configs.length - 1; configIndex++) {
        const upperConfig = configs[configIndex]!;
        const lowerConfig = configs[configIndex + 1]!;
        if (cameraRadius >= lowerConfig.minCameraRadius) {
            const interpolation = MathUtils.clamp(
                (cameraRadius - lowerConfig.minCameraRadius) /
                    (upperConfig.minCameraRadius - lowerConfig.minCameraRadius),
                0,
                1,
            );
            return MathUtils.lerp(lowerConfig.labelScaleHeight, upperConfig.labelScaleHeight, interpolation);
        }
    }

    return lastConfig.labelScaleHeight;
}

/** The deepest tier — used to pre-allocate the dot position buffer once. */
const CITY_LOD_MAX_DOTS = CITY_LOD_CONFIGS.reduce((highest, config) => Math.max(highest, config.maxDots), 0);

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

function applyLabelSpriteScale(labelSprite: Sprite, aspectRatio: number, labelScaleHeight: number): void {
    labelSprite.scale.set(aspectRatio * labelScaleHeight, labelScaleHeight, 1.0);
}

/**
 * Smoothly expands the allowed label-loading window as the camera zooms in.
 * Far out we keep cities constrained to the centre 45% of the viewport;
 * for the two closest zoom tiers we stop clipping entirely and allow the full
 * viewport so near-detail exploration does not lose edge cities.
 */
function resolveLabelViewportNdcLimit(cameraRadius: number): number {
    const furthestTightRadius = 2.6;
    const fullViewportRadius = 1.45;

    if (cameraRadius >= furthestTightRadius) return 0.45;
    if (cameraRadius <= fullViewportRadius) return 1.0;

    const interpolation = (furthestTightRadius - cameraRadius) / (furthestTightRadius - fullViewportRadius);
    return 0.45 + interpolation * 0.55;
}

// ── Sprite factory ────────────────────────────────────────────────────────────

/**
 * Creates a billboard Sprite whose texture is the city name rendered onto a
 * tight canvas. Caller is responsible for calling disposeLabelSprite() when done.
 */
function createCityLabelSprite(cityName: string, labelScaleHeight: number): Sprite {
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
    labelSprite.userData['aspectRatio'] = aspectRatio;
    applyLabelSpriteScale(labelSprite, aspectRatio, labelScaleHeight);

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
    // One Points object covers all city dots in a single draw call. Allocated
    // once at the deepest LOD's capacity; `setDrawRange` controls how many are
    // visible per zoom tier.
    let dotPoints: Points | null = null;
    let dotGlowTexture: CanvasTexture | null = null;
    /** Number of dot positions currently active in the shared point buffer. */
    let dotCitiesWrittenCount = 0;

    // ── Label sprite state ────────────────────────────────────────────────────
    // Map from city.id → Sprite. Sprites are created lazily as the active LOD
    // tier expands and disposed when the tier shrinks below their rank, so
    // GPU texture memory tracks visible density, not dataset size.
    const cityLabelSprites = new Map<string, Sprite>();
    const spriteToCity = new Map<Sprite, City>();
    /** Surface normal (unit vector) per city — used for back-face culling. */
    const cityNormals = new Map<string, Vector3>();
    let lodAnimationFrameId = 0;
    const previousCameraPosition = new Vector3();
    let previousCameraRadius = 0;
    let hasCameraSnapshot = false;

    // Reusable objects allocated once to avoid GC churn inside the 200 ms poll.
    const reusableViewProjectionMatrix = new Matrix4();
    const reusableViewFrustum = new Frustum();
    const reusableLabelPosition = new Vector3();
    const reusableProjectedLabelPosition = new Vector3();
    const reusableCameraDirection = new Vector3();

    // Reusable raycaster + NDC vector for the hover cursor check (mousemove path).
    const hoverRaycaster = new Raycaster();
    const hoverNdc = new Vector2();

    // ── Dot points lifecycle ──────────────────────────────────────────────────

    function ensureDotPoints(): Points {
        if (dotPoints) return dotPoints;
        if (!dotGlowTexture) dotGlowTexture = createDotGlowTexture();

        const dotGeometry = new BufferGeometry();
        const positionsArray = new Float32Array(CITY_LOD_MAX_DOTS * 3);
        dotGeometry.setAttribute('position', new Float32BufferAttribute(positionsArray, 3));
        dotGeometry.setDrawRange(0, 0);

        const dotMaterial = new PointsMaterial({
            color: 0xffffff,
            size: MARKER_DOT_SIZE_PX,
            map: dotGlowTexture,
            sizeAttenuation: false,
            transparent: true,
            depthTest: true,
            depthWrite: false,
            blending: AdditiveBlending,
        });

        dotPoints = new Points(dotGeometry, dotMaterial);
        dotPoints.frustumCulled = false;
        return dotPoints;
    }

    function destroyDotPoints(): void {
        if (!dotPoints) return;
        globeSceneHandleRef.value?.scene.remove(dotPoints);
        dotPoints.geometry.dispose();
        (dotPoints.material as PointsMaterial).dispose();
        dotPoints = null;
        dotCitiesWrittenCount = 0;
    }

    /**
     * Rewrites the shared point buffer with the currently focused visible city
     * set. Dots must follow the same focus area as labels; a global top-N list
     * makes edge countries look "loaded" even when the user is not looking at
     * them.
     */
    function syncDotPositions(cities: readonly City[]): void {
        const points = ensureDotPoints();
        const positionAttribute = points.geometry.attributes['position']!;
        const positionsArray = positionAttribute.array as Float32Array;

        const writeUntil = Math.min(cities.length, CITY_LOD_MAX_DOTS);
        for (let cityIndex = 0; cityIndex < writeUntil; cityIndex++) {
            const city = cities[cityIndex]!;
            const dotPosition = latLngTo3D(city.lat, city.lng, MARKER_SURFACE_RADIUS);
            positionsArray[cityIndex * 3] = dotPosition.x;
            positionsArray[cityIndex * 3 + 1] = dotPosition.y;
            positionsArray[cityIndex * 3 + 2] = dotPosition.z;
        }

        // Clear any trailing stale positions if the focused set shrank.
        for (let cityIndex = writeUntil; cityIndex < dotCitiesWrittenCount; cityIndex++) {
            positionsArray[cityIndex * 3] = 0;
            positionsArray[cityIndex * 3 + 1] = 0;
            positionsArray[cityIndex * 3 + 2] = 0;
        }

        positionAttribute.needsUpdate = true;
        dotCitiesWrittenCount = writeUntil;
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

    // ── LOD application ───────────────────────────────────────────────────────

    /**
     * Reconciles label sprite allocation to exactly match the provided set of
     * viewport-visible cities. Sprites for cities no longer visible are disposed;
     * sprites for newly visible cities are lazily created. Memory therefore tracks
     * what is actually on screen, not the full dataset or the LOD tier cap.
     */
    function reconcileViewportLabels(viewportCities: readonly City[], labelScaleHeight: number): void {
        const sceneHandle = globeSceneHandleRef.value;
        if (!sceneHandle) return;

        // Build a fast lookup of which city IDs should be visible this frame.
        const targetCityIds = new Set<string>(viewportCities.map((city) => city.id));

        // Shrink: dispose sprites that left the viewport.
        for (const [cityId, labelSprite] of cityLabelSprites) {
            if (!targetCityIds.has(cityId)) {
                sceneHandle.scene.remove(labelSprite);
                spriteToCity.delete(labelSprite);
                disposeLabelSprite(labelSprite);
                cityLabelSprites.delete(cityId);
            }
        }

        // Grow: allocate sprites for newly visible cities and ensure all are shown.
        for (const city of viewportCities) {
            let labelSprite = cityLabelSprites.get(city.id);
            if (!labelSprite) {
                labelSprite = createCityLabelSprite(city.name, labelScaleHeight);
                const labelPosition = latLngTo3D(city.lat, city.lng, LABEL_SURFACE_RADIUS);
                labelSprite.position.set(labelPosition.x, labelPosition.y, labelPosition.z);
                cityLabelSprites.set(city.id, labelSprite);
                spriteToCity.set(labelSprite, city);
                sceneHandle.scene.add(labelSprite);
            }
            const aspectRatio = Number(labelSprite.userData['aspectRatio'] ?? 1);
            applyLabelSpriteScale(labelSprite, aspectRatio, labelScaleHeight);
            labelSprite.visible = true;
        }
    }

    /**
     * Single source of LOD truth. Runs every 200 ms and on data/scene changes.
     *
     * Dots  — global top-N by population (setDrawRange controls count; the sphere
     *          naturally occludes back-hemisphere dots via depth testing).
     * Labels — top-N by population filtered to the current camera viewport: only
     *          cities that face the camera AND lie within the frustum get sprites,
     *          so the labels shown are always the most significant cities that are
     *          actually visible right now.
     */
    function applyCurrentLod(): void {
        const sceneHandle = globeSceneHandleRef.value;
        if (!sceneHandle) return;
        const cities = cachedCitiesRef.value;
        if (cities.length === 0) return;
        const camera = sceneHandle.camera;

        const cameraPosition = camera.position;
        const cameraRadius = cameraPosition.length();
        const lodConfig = resolveCityLod(cameraRadius);
        const labelViewportNdcLimit = resolveLabelViewportNdcLimit(cameraRadius);

        // ── Labels: viewport-visible top-N ────────────────────────────────────
        // Build the camera frustum once for this poll. camera.matrixWorld must
        // be current — the render loop calls camera.updateMatrixWorld() each
        // frame, so by the time the poll fires it is already up to date. We call
        // it here too as a safety net for the first poll before the first frame.
        camera.updateMatrixWorld();
        reusableViewProjectionMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
        reusableViewFrustum.setFromProjectionMatrix(reusableViewProjectionMatrix);
        reusableCameraDirection.copy(cameraPosition).normalize();

        // For a unit sphere observed from distance r, the visible cap is
        // defined by n·v >= 1/r where n is the surface normal and v is the
        // camera direction from globe centre. Anything below that sits beyond
        // the geometric horizon and must never show a label.
        const minimumVisibleDot = 1 / Math.max(cameraRadius, 1.0001);

        // Walk cities in population-descending order (already sorted). Accept a
        // city only if it passes both the back-face and frustum tests. Stop once
        // the tier's label cap is reached so we never allocate more than needed.
        const visibleFocusedCities: City[] = [];
        for (let cityIndex = 0; cityIndex < cities.length; cityIndex++) {
            const city = cities[cityIndex]!;

            // Cache the surface normal (unit vector pointing outward from globe).
            let cityNormal = cityNormals.get(city.id);
            if (!cityNormal) {
                cityNormal = latLngTo3D(city.lat, city.lng, 1.0);
                cityNormals.set(city.id, cityNormal);
            }

            // Horizon test: city must lie on the actually visible spherical cap,
            // not just the rough front hemisphere.
            if (cityNormal.dot(reusableCameraDirection) < minimumVisibleDot) continue;

            // Frustum test: city label position must be inside the view volume.
            reusableLabelPosition.copy(cityNormal).multiplyScalar(LABEL_SURFACE_RADIUS);
            if (!reusableViewFrustum.containsPoint(reusableLabelPosition)) continue;

            // Viewport-space focus gate. Keep the highest zoom tighter than the
            // full screen so city registration does not flood the edges.
            reusableProjectedLabelPosition.copy(reusableLabelPosition).project(camera);
            const normalizedDistanceFromCenter = Math.hypot(
                reusableProjectedLabelPosition.x,
                reusableProjectedLabelPosition.y,
            );
            if (normalizedDistanceFromCenter > labelViewportNdcLimit) continue;

            visibleFocusedCities.push(city);
            if (visibleFocusedCities.length >= lodConfig.maxDots) break;
        }

        // ── Dots: focused visible top-N by population ────────────────────────
        syncDotPositions(visibleFocusedCities);
        ensureDotPoints().geometry.setDrawRange(0, visibleFocusedCities.length);

        reconcileViewportLabels(
            visibleFocusedCities.slice(0, lodConfig.maxLabels),
            resolveCityLabelScaleHeight(cameraRadius),
        );
    }

    function runLodFrame(): void {
        lodAnimationFrameId = 0;

        const camera = globeSceneHandleRef.value?.camera;
        if (camera && cachedCitiesRef.value.length > 0) {
            const cameraRadius = camera.position.length();
            const cameraMoved =
                !hasCameraSnapshot ||
                previousCameraPosition.distanceToSquared(camera.position) > 0.000001 ||
                Math.abs(cameraRadius - previousCameraRadius) > 0.0001;

            if (cameraMoved) {
                applyCurrentLod();
                previousCameraPosition.copy(camera.position);
                previousCameraRadius = cameraRadius;
                hasCameraSnapshot = true;
            }
        }

        lodAnimationFrameId = requestAnimationFrame(runLodFrame);
    }

    function startLodLoop(): void {
        if (lodAnimationFrameId !== 0) return;
        lodAnimationFrameId = requestAnimationFrame(runLodFrame);
    }

    function stopLodLoop(): void {
        if (lodAnimationFrameId !== 0) {
            cancelAnimationFrame(lodAnimationFrameId);
            lodAnimationFrameId = 0;
        }
    }

    // ── Initial scene wiring when cities first arrive ─────────────────────────

    function attachDotPointsToScene(): void {
        const sceneHandle = globeSceneHandleRef.value;
        if (!sceneHandle) return;
        const points = ensureDotPoints();
        if (!sceneHandle.scene.children.includes(points)) {
            sceneHandle.scene.add(points);
        }
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

    watch(cachedCitiesRef, () => {
        attachDotPointsToScene();
        // Cities arrived (or replaced). Reset any cached writes that referenced
        // the previous list so the new positions are written from scratch.
        dotCitiesWrittenCount = 0;
        hasCameraSnapshot = false;
        applyCurrentLod();
    });

    watch(globeSceneHandleRef, (newHandle) => {
        if (!newHandle) return;

        // Re-attach scene objects when the scene handle is (re)created.
        if (dotPoints) newHandle.scene.add(dotPoints);
        for (const labelSprite of cityLabelSprites.values()) {
            newHandle.scene.add(labelSprite);
        }

        if (cachedCitiesRef.value.length > 0) {
            attachDotPointsToScene();
            hasCameraSnapshot = false;
            applyCurrentLod();
        }
    });

    onMounted(() => {
        startLodLoop();
        canvasRef.value?.addEventListener('pointermove', handlePointerMove);
    });

    onBeforeUnmount(() => {
        stopLodLoop();
        canvasRef.value?.removeEventListener('pointermove', handlePointerMove);
        destroyDotPoints();
        dotGlowTexture?.dispose();
        dotGlowTexture = null;
        destroyAllLabelSprites();
    });

    return { getIntersectedCity };
}
