import { CanvasTexture, LinearFilter, SRGBColorSpace } from 'three';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type CountrySymbolType =
    | 'snowflake'
    | 'mountains'
    | 'palmTree'
    | 'pyramid'
    | 'cherryBlossom'
    | 'mapleLeaf'
    | 'cactus'
    | 'camel';

// ─────────────────────────────────────────────────────────────────────────────
// Country map  (ISO 3166-1 numeric code → symbol type)
// Keys match the `id` property on world-atlas topojson features.
// ─────────────────────────────────────────────────────────────────────────────

export const COUNTRY_SYMBOL_MAP: Record<string, CountrySymbolType> = {
    '643': 'snowflake', // Russia
    '499': 'mountains', // Montenegro
    '124': 'mapleLeaf', // Canada
    '076': 'palmTree', // Brazil
    '036': 'palmTree', // Australia
    '392': 'cherryBlossom', // Japan
    '818': 'pyramid', // Egypt
    '356': 'palmTree', // India
    '578': 'snowflake', // Norway
    '352': 'snowflake', // Iceland
    '484': 'cactus', // Mexico
    '682': 'camel', // Saudi Arabia
    '604': 'mountains', // Peru
    '756': 'mountains', // Switzerland
    '246': 'snowflake', // Finland
    '752': 'snowflake', // Sweden
    '792': 'mountains', // Turkey
    '554': 'mountains', // New Zealand
    '566': 'palmTree', // Nigeria
    '144': 'palmTree', // Sri Lanka
    '504': 'camel', // Morocco
    '706': 'camel', // Somalia
    '710': 'palmTree', // South Africa
    '032': 'mountains', // Argentina
    '152': 'mountains', // Chile
    '064': 'mountains', // Bhutan
    '524': 'mountains', // Nepal
    '586': 'mountains', // Pakistan (Karakoram)
};

// ─────────────────────────────────────────────────────────────────────────────
// Individual symbol draw functions
// All functions draw centered at (cx, cy) with the given radius.
// They call save/restore so callers don't need to worry about state leakage.
// ─────────────────────────────────────────────────────────────────────────────

function drawSnowflake(context: CanvasRenderingContext2D, cx: number, cy: number, radius: number): void {
    context.save();
    context.strokeStyle = 'rgba(190, 230, 255, 0.92)';
    context.lineWidth = Math.max(1, radius * 0.11);
    context.lineCap = 'round';
    context.shadowColor = 'rgba(130, 200, 255, 0.7)';
    context.shadowBlur = radius * 0.6;

    for (let armIndex = 0; armIndex < 6; armIndex++) {
        const armAngle = (armIndex * Math.PI) / 3;

        // Main arm
        context.beginPath();
        context.moveTo(cx, cy);
        context.lineTo(cx + Math.cos(armAngle) * radius, cy + Math.sin(armAngle) * radius);
        context.stroke();

        // Branch pairs at 50% and 70% along the arm
        for (const fraction of [0.5, 0.7]) {
            const branchBaseX = cx + Math.cos(armAngle) * radius * fraction;
            const branchBaseY = cy + Math.sin(armAngle) * radius * fraction;
            const branchLength = radius * 0.32;

            for (const branchSign of [-1, 1]) {
                const branchAngle = armAngle + branchSign * (Math.PI / 3);
                context.beginPath();
                context.moveTo(branchBaseX, branchBaseY);
                context.lineTo(
                    branchBaseX + Math.cos(branchAngle) * branchLength,
                    branchBaseY + Math.sin(branchAngle) * branchLength,
                );
                context.stroke();
            }
        }
    }

    // Center dot
    context.beginPath();
    context.arc(cx, cy, radius * 0.13, 0, Math.PI * 2);
    context.fillStyle = 'rgba(220, 245, 255, 0.95)';
    context.fill();

    context.restore();
}

function drawMountains(context: CanvasRenderingContext2D, cx: number, cy: number, radius: number): void {
    context.save();
    context.shadowColor = 'rgba(0, 0, 0, 0.22)';
    context.shadowBlur = radius * 0.3;

    const baselineY = cy + radius * 0.55;

    // Back peak (left, slightly shorter)
    const backPeakX = cx - radius * 0.2;
    const backPeakY = cy - radius * 0.68;
    context.beginPath();
    context.moveTo(cx - radius * 0.9, baselineY);
    context.lineTo(backPeakX, backPeakY);
    context.lineTo(cx + radius * 0.45, baselineY);
    context.closePath();
    context.fillStyle = 'rgba(120, 158, 195, 0.85)';
    context.fill();

    // Front peak (right, taller, overlaps back)
    const frontPeakX = cx + radius * 0.15;
    const frontPeakY = cy - radius * 0.95;
    context.beginPath();
    context.moveTo(cx - radius * 0.35, baselineY);
    context.lineTo(frontPeakX, frontPeakY);
    context.lineTo(cx + radius * 0.9, baselineY);
    context.closePath();
    context.fillStyle = 'rgba(150, 185, 220, 0.85)';
    context.fill();

    // Snow cap — back peak
    context.beginPath();
    context.moveTo(backPeakX - radius * 0.12, backPeakY + radius * 0.2);
    context.lineTo(backPeakX, backPeakY);
    context.lineTo(backPeakX + radius * 0.12, backPeakY + radius * 0.2);
    context.closePath();
    context.fillStyle = 'rgba(255, 255, 255, 0.9)';
    context.fill();

    // Snow cap — front peak
    context.beginPath();
    context.moveTo(frontPeakX - radius * 0.15, frontPeakY + radius * 0.22);
    context.lineTo(frontPeakX, frontPeakY);
    context.lineTo(frontPeakX + radius * 0.15, frontPeakY + radius * 0.22);
    context.closePath();
    context.fillStyle = 'rgba(255, 255, 255, 0.92)';
    context.fill();

    context.restore();
}

function drawPalmTree(context: CanvasRenderingContext2D, cx: number, cy: number, radius: number): void {
    context.save();
    context.lineCap = 'round';
    context.shadowColor = 'rgba(0, 0, 0, 0.2)';
    context.shadowBlur = radius * 0.3;

    const trunkBottomY = cy + radius * 0.9;
    const trunkTopY = cy - radius * 0.25;

    // Trunk — slightly curved quadratic
    context.beginPath();
    context.moveTo(cx - radius * 0.05, trunkBottomY);
    context.quadraticCurveTo(cx + radius * 0.18, cy + radius * 0.2, cx, trunkTopY);
    context.lineWidth = Math.max(1.5, radius * 0.18);
    context.strokeStyle = 'rgba(155, 105, 50, 0.92)';
    context.stroke();

    // 5 fronds radiating from the crown
    const frondBaseAngles = [-2.1, -1.15, -0.1, 0.85, 1.8];
    for (const baseAngle of frondBaseAngles) {
        const frondLength = radius * 0.88;
        const tipX = cx + Math.cos(baseAngle) * frondLength;
        const tipY = trunkTopY + Math.sin(baseAngle) * frondLength;
        const controlX = cx + Math.cos(baseAngle) * frondLength * 0.55;
        const controlY = trunkTopY + Math.sin(baseAngle) * frondLength * 0.55 + radius * 0.22;

        context.beginPath();
        context.moveTo(cx, trunkTopY);
        context.quadraticCurveTo(controlX, controlY, tipX, tipY);
        context.lineWidth = Math.max(1, radius * 0.1);
        context.strokeStyle = 'rgba(50, 155, 55, 0.92)';
        context.stroke();
    }

    context.restore();
}

function drawPyramid(context: CanvasRenderingContext2D, cx: number, cy: number, radius: number): void {
    context.save();
    context.shadowColor = 'rgba(0, 0, 0, 0.2)';
    context.shadowBlur = radius * 0.3;

    const tipY = cy - radius * 0.85;
    const baseY = cy + radius * 0.6;
    const halfBaseWidth = radius * 1.05;

    // Left face (shadowed)
    context.beginPath();
    context.moveTo(cx - halfBaseWidth, baseY);
    context.lineTo(cx, tipY);
    context.lineTo(cx, baseY);
    context.closePath();
    context.fillStyle = 'rgba(195, 155, 70, 0.88)';
    context.fill();

    // Right face (lit)
    context.beginPath();
    context.moveTo(cx, tipY);
    context.lineTo(cx + halfBaseWidth, baseY);
    context.lineTo(cx, baseY);
    context.closePath();
    context.fillStyle = 'rgba(230, 195, 105, 0.88)';
    context.fill();

    // Horizontal stone course lines (thirds)
    context.strokeStyle = 'rgba(155, 115, 40, 0.55)';
    for (let courseIndex = 1; courseIndex <= 2; courseIndex++) {
        const fraction = courseIndex / 3;
        const courseY = tipY + (baseY - tipY) * fraction;
        const courseHalfWidth = halfBaseWidth * fraction;
        context.beginPath();
        context.moveTo(cx - courseHalfWidth, courseY);
        context.lineTo(cx + courseHalfWidth, courseY);
        context.lineWidth = Math.max(0.5, radius * 0.055);
        context.stroke();
    }

    context.restore();
}

function drawCherryBlossom(context: CanvasRenderingContext2D, cx: number, cy: number, radius: number): void {
    context.save();
    context.shadowColor = 'rgba(210, 80, 130, 0.45)';
    context.shadowBlur = radius * 0.65;

    const petalCount = 5;
    const petalRadius = radius * 0.42;
    const petalOffset = radius * 0.48;

    for (let petalIndex = 0; petalIndex < petalCount; petalIndex++) {
        const petalAngle = (petalIndex * Math.PI * 2) / petalCount - Math.PI / 2;
        const petalCenterX = cx + Math.cos(petalAngle) * petalOffset;
        const petalCenterY = cy + Math.sin(petalAngle) * petalOffset;

        context.beginPath();
        context.ellipse(petalCenterX, petalCenterY, petalRadius, petalRadius * 0.68, petalAngle, 0, Math.PI * 2);
        context.fillStyle = 'rgba(255, 185, 200, 0.88)';
        context.fill();
        context.strokeStyle = 'rgba(220, 120, 155, 0.55)';
        context.lineWidth = Math.max(0.5, radius * 0.04);
        context.stroke();
    }

    // Golden center
    context.beginPath();
    context.arc(cx, cy, radius * 0.2, 0, Math.PI * 2);
    context.fillStyle = 'rgba(255, 220, 90, 0.92)';
    context.fill();

    context.restore();
}

// Normalized maple leaf polygon vertices (x/y in [-1, 1], pointing up).
// Traced from the canonical 11-point silhouette used on the Canadian flag.
const MAPLE_LEAF_POLYGON: ReadonlyArray<[number, number]> = [
    [0, -1],
    [0.17, -0.5],
    [0.58, -0.68],
    [0.34, -0.2],
    [0.98, 0.08],
    [0.5, 0.14],
    [0.62, 0.64],
    [0.14, 0.38],
    [0.22, 0.98],
    [0, 0.68],
    [-0.22, 0.98],
    [-0.14, 0.38],
    [-0.62, 0.64],
    [-0.5, 0.14],
    [-0.98, 0.08],
    [-0.34, -0.2],
    [-0.58, -0.68],
    [-0.17, -0.5],
];

function drawMapleLeaf(context: CanvasRenderingContext2D, cx: number, cy: number, radius: number): void {
    context.save();
    context.shadowColor = 'rgba(180, 30, 0, 0.4)';
    context.shadowBlur = radius * 0.5;

    context.beginPath();
    for (let vertexIndex = 0; vertexIndex < MAPLE_LEAF_POLYGON.length; vertexIndex++) {
        const [normalizedX, normalizedY] = MAPLE_LEAF_POLYGON[vertexIndex]!;
        const vertexX = cx + normalizedX * radius;
        const vertexY = cy + normalizedY * radius;
        if (vertexIndex === 0) {
            context.moveTo(vertexX, vertexY);
        } else {
            context.lineTo(vertexX, vertexY);
        }
    }
    context.closePath();
    context.fillStyle = 'rgba(210, 35, 20, 0.88)';
    context.fill();

    context.restore();
}

function drawCactus(context: CanvasRenderingContext2D, cx: number, cy: number, radius: number): void {
    context.save();
    context.strokeStyle = 'rgba(55, 135, 55, 0.92)';
    context.lineWidth = Math.max(2, radius * 0.22);
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.shadowColor = 'rgba(0, 80, 0, 0.3)';
    context.shadowBlur = radius * 0.4;

    // Main trunk
    context.beginPath();
    context.moveTo(cx, cy + radius * 0.9);
    context.lineTo(cx, cy - radius * 0.85);
    context.stroke();

    // Left arm — horizontal then up
    const leftArmY = cy - radius * 0.08;
    context.beginPath();
    context.moveTo(cx, leftArmY);
    context.lineTo(cx - radius * 0.65, leftArmY);
    context.lineTo(cx - radius * 0.65, leftArmY - radius * 0.58);
    context.stroke();

    // Right arm — horizontal then up, slightly higher
    const rightArmY = cy + radius * 0.18;
    context.beginPath();
    context.moveTo(cx, rightArmY);
    context.lineTo(cx + radius * 0.65, rightArmY);
    context.lineTo(cx + radius * 0.65, rightArmY - radius * 0.58);
    context.stroke();

    context.restore();
}

function drawCamel(context: CanvasRenderingContext2D, cx: number, cy: number, radius: number): void {
    context.save();
    context.shadowColor = 'rgba(0, 0, 0, 0.18)';
    context.shadowBlur = radius * 0.3;

    const bodyColor = 'rgba(210, 172, 90, 0.88)';
    const shadowColor = 'rgba(175, 135, 60, 0.88)';
    const bodyY = cy + radius * 0.12;

    // Body ellipse
    context.beginPath();
    context.ellipse(cx, bodyY, radius * 0.7, radius * 0.32, 0, 0, Math.PI * 2);
    context.fillStyle = bodyColor;
    context.fill();

    // Left hump (taller)
    context.beginPath();
    context.arc(cx - radius * 0.22, bodyY - radius * 0.28, radius * 0.27, Math.PI, 0, false);
    context.fillStyle = bodyColor;
    context.fill();

    // Right hump (shorter)
    context.beginPath();
    context.arc(cx + radius * 0.22, bodyY - radius * 0.24, radius * 0.22, Math.PI, 0, false);
    context.fillStyle = bodyColor;
    context.fill();

    // Neck + head — quadratic arc to the right
    context.beginPath();
    context.moveTo(cx + radius * 0.58, bodyY - radius * 0.15);
    context.quadraticCurveTo(cx + radius * 0.92, bodyY - radius * 0.45, cx + radius * 0.88, bodyY - radius * 0.68);
    context.lineWidth = Math.max(2, radius * 0.2);
    context.strokeStyle = bodyColor;
    context.lineCap = 'round';
    context.stroke();

    // Head circle
    context.beginPath();
    context.arc(cx + radius * 0.85, bodyY - radius * 0.78, radius * 0.15, 0, Math.PI * 2);
    context.fillStyle = bodyColor;
    context.fill();

    // Four legs
    const legOffsets = [-0.42, -0.18, 0.12, 0.42];
    context.lineWidth = Math.max(1.5, radius * 0.12);
    context.strokeStyle = shadowColor;
    context.lineCap = 'round';
    for (const legOffsetX of legOffsets) {
        context.beginPath();
        context.moveTo(cx + legOffsetX * radius, bodyY + radius * 0.28);
        context.lineTo(cx + legOffsetX * radius, bodyY + radius * 0.72);
        context.stroke();
    }

    context.restore();
}

// ─────────────────────────────────────────────────────────────────────────────
// Dispatch table — keeps drawCountrySymbols clean
// ─────────────────────────────────────────────────────────────────────────────

const SYMBOL_DRAW_FUNCTIONS: Record<
    CountrySymbolType,
    (context: CanvasRenderingContext2D, cx: number, cy: number, radius: number) => void
> = {
    snowflake: drawSnowflake,
    mountains: drawMountains,
    palmTree: drawPalmTree,
    pyramid: drawPyramid,
    cherryBlossom: drawCherryBlossom,
    mapleLeaf: drawMapleLeaf,
    cactus: drawCactus,
    camel: drawCamel,
};

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a high-DPI square canvas texture containing one country symbol,
 * ready to use as a Three.js SpriteMaterial map.
 *
 * @param symbolType - Which symbol to draw.
 * @param canvasSize - Canvas width/height in pixels. Default 256.
 */
export function createSymbolTexture(symbolType: CountrySymbolType, canvasSize: number = 256): CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = canvasSize;
    canvas.height = canvasSize;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('createSymbolTexture: 2D context unavailable');

    const center = canvasSize / 2;
    const drawingRadius = canvasSize * 0.38; // ~38% of canvas size leaves safe padding

    const drawFunction = SYMBOL_DRAW_FUNCTIONS[symbolType];
    drawFunction(context, center, center, drawingRadius);

    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.minFilter = LinearFilter;
    texture.magFilter = LinearFilter;
    texture.needsUpdate = true;
    return texture;
}
