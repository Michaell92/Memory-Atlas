import type { CanvasTexture, Mesh, PerspectiveCamera, Points, Scene, Spherical, Vector3, WebGLRenderer } from 'three';

export interface GlobeHitResult {
    /** Latitude in degrees, [-90, 90]. */
    lat: number;
    /** Longitude in degrees, [-180, 180]. */
    lng: number;
    /** World-space intersection point on the globe surface. */
    point: Vector3;
}

export interface DetectedCountry {
    /** Numeric country code from the world-atlas topology (e.g. "076" for Brazil). */
    countryCode: string;
    /** Display name of the country. */
    countryName: string;
}

/**
 * Container for the long-lived Three.js objects owned by the Globe scene.
 * Composables return this so callers can extend or inspect — but should not
 * mutate the renderer/scene lifecycle directly.
 */
export interface GlobeSceneHandle {
    scene: Scene;
    camera: PerspectiveCamera;
    renderer: WebGLRenderer;
    globe: Mesh;
    /** Stop the RAF loop and dispose GPU resources. Idempotent. */
    dispose: () => void;
}

export interface GlobeSceneOptions {
    /** Globe radius in world units. Default 1. */
    radius?: number;
    /** Sphere segments — keep modest until textures arrive. Default 64. */
    segments?: number;
    /** Show stats.js FPS overlay (forced off in production). Default true in dev. */
    showStats?: boolean;
    /** Enable bloom postprocessing. Default true. */
    bloom?: boolean;
}

export interface CameraControllerOptions {
    initialRadius?: number;
    minRadius?: number;
    maxRadius?: number;
    initialPhi?: number;
    minPhi?: number;
    maxPhi?: number;
    rotateSpeed?: number;
    zoomSpeed?: number;
    /** Higher = velocity decays faster (snappier feel). Default 4.5. */
    damping?: number;
    /** Idle rotation speed in rad/sec when user isn't touching the globe. */
    autoRotateSpeed?: number;
}

export interface CameraControllerHandle {
    update: (deltaSeconds: number) => void;
    dispose: () => void;
    setAutoRotate: (enabled: boolean) => void;
    flyTo: (radius: number, theta: number, phi: number) => void;
    /** Live spherical state — safe to read in tweens, prefer flyTo for writes. */
    spherical: Spherical;
    target: Vector3;
}

export interface StarfieldOptions {
    /** Total stars distributed uniformly on the celestial sphere. Default 6000. */
    uniformStarCount?: number;
    /** Extra stars biased toward a tilted galactic band. Default 2000. */
    galacticBandStarCount?: number;
    /** Distance of the star sphere from origin in world units. Default 80. */
    radius?: number;
    /** Tilt of the galactic plane in radians. Default 0.35 (~20°). */
    galacticTilt?: number;
    /** Multiplier applied to all star point sizes. Default 1. */
    sizeScale?: number;
}

export interface StarfieldHandle {
    /** The Points object to add to your scene. */
    object: Points;
    /** Drive twinkling — call once per frame with total elapsed time in seconds. */
    update: (elapsedSeconds: number) => void;
    /** Release GPU resources. Idempotent. */
    dispose: () => void;
}

export interface CosmicPhenomenaOptions {
    /** Steady, intensely bright blue-white pinpoints. Default 2. */
    whiteDwarfCount?: number;
    /** Large, warm, slowly breathing stars. Default 3. */
    redGiantCount?: number;
    /** Rapidly flashing dense stars. Default 1. */
    pulsarCount?: number;
    /** Number of binary systems (each = 2 stars in mutual orbit). Default 1. */
    binarySystemCount?: number;
    /** Seconds between supernova flashes. Default 35. */
    supernovaIntervalSeconds?: number;
    /** Duration of each supernova flash in seconds. Default 1.6. */
    supernovaFlashDuration?: number;
    /** Distance from origin where phenomena are placed. Default 70. */
    radius?: number;
}

export interface CosmicPhenomenaHandle {
    /** The Points object to add to your scene. */
    object: Points;
    /** Drive all phenomena animations — call once per frame. */
    update: (elapsedSeconds: number, deltaSeconds: number) => void;
    /** Release GPU resources. Idempotent. */
    dispose: () => void;
}

export interface AtmosphereOptions {
    /** Radius of the planet the atmosphere wraps. Default 1. */
    planetRadius?: number;
    /** Shell radius as a multiple of the planet radius. Default 1.15. */
    scale?: number;
    /** Day-side rim color (CSS string or Three Color-compatible). Default '#5aa9ff'. */
    color?: string;
    /** Night-side whisper color, very dim. Default '#0a2540'. */
    nightColor?: string;
    /** Fresnel falloff exponent — higher = thinner rim. Default 3.2. */
    fresnelPower?: number;
    /** Overall multiplier on rim brightness. Default 1.4. */
    intensity?: number;
    /** World-space direction the sun is coming from. Default matches the scene sun. */
    sunDirection?: Vector3;
}

export interface AtmosphereHandle {
    /** The Mesh to add to your scene. */
    object: Mesh;
    /** Update the lighting direction if the sun moves (e.g. day/night cycles). */
    setSunDirection: (direction: Vector3) => void;
    /** Release GPU resources. Idempotent. */
    dispose: () => void;
}

export interface EarthTextureOptions {
    /** Texture width in pixels. Height is always width/2 (equirectangular). Default 4096. */
    width?: number;
    /** Color filling the ocean. Default '#1d3b8a'. */
    oceanColor?: string;
    /** Border stroke color between countries. Default '#ffffff'. */
    borderColor?: string;
    /** Border stroke width in canvas pixels. Default 1.5. */
    borderWidth?: number;
    /** Palette of pastel fills countries are randomly assigned from. */
    countryPalette?: string[];
    /** Seed for deterministic country-to-color assignment. Default 1. */
    paletteSeed?: number;
    /**
     * Topology resolution from world-atlas. '110m' is fastest (rough),
     * '50m' medium, '10m' is highest detail (~few MB). Default '110m'.
     */
    resolution?: '110m' | '50m' | '10m';
}

export interface EarthTextureHandle {
    /** The CanvasTexture ready to plug into a material's `.map`. */
    texture: CanvasTexture;
    /** The raw 2D canvas, exposed for overlay drawing (mountains, icons, etc.). */
    canvas: HTMLCanvasElement;
    /** Re-render the base map (call after mutating options). */
    redraw: () => void;
    /** Release GPU resources. Idempotent. */
    dispose: () => void;
}

export interface CountryBordersOptions {
    /** Globe surface radius in world units. Default 1. */
    globeRadius?: number;
    /** Topology resolution. Default '50m'. */
    resolution?: '110m' | '50m' | '10m';
    /** CSS-compatible border color. Default '#ffffff'. */
    color?: string;
    /** Line opacity 0-1. Default 0.55. */
    opacity?: number;
}

export interface CountryBordersHandle {
    /** The LineSegments object to add to your scene. */
    object: import('three').LineSegments;
    /** Release GPU resources. Idempotent. */
    dispose: () => void;
}

export interface CountrySymbolsOptions {
    /** Globe surface radius in world units. Default 1. */
    globeRadius?: number;
    /** Topology resolution. Default '50m'. */
    resolution?: '110m' | '50m' | '10m';
    /** Sprite world-space size as a fraction of globeRadius. Default 0.09. */
    spriteWorldSize?: number;
    /** Canvas side length in pixels for each symbol texture. Default 256. */
    symbolCanvasSize?: number;
}

export interface CountrySymbolsHandle {
    /** The Group containing all country symbol Sprites. Add to your scene. */
    object: import('three').Group;
    /** Dispose all sprite materials and textures. Idempotent. */
    dispose: () => void;
}
