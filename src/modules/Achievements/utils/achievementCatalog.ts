import type {
    AchievementCardViewModel,
    AchievementDefinition,
    AchievementMetric,
    AchievementMetrics,
} from '@/modules/Achievements/types/achievement.types';

export const TOTAL_WORLD_COUNTRY_COUNT = 195;

export const DEFAULT_ACHIEVEMENT_METRICS: AchievementMetrics = {
    unlockedCountriesCount: 0,
    unlockedCitiesCount: 0,
    unlockedPlacesCount: 0,
    worldConqueredPercentage: 0,
};

export const ACHIEVEMENT_DEFINITIONS: readonly AchievementDefinition[] = [
    {
        id: 'first-stamp',
        title: 'First Stamp',
        description: 'Log your first country and start bending the atlas to your own story.',
        metric: 'countries',
        threshold: 1,
        accentStart: '#73d3ff',
        accentEnd: '#1b74ff',
    },
    {
        id: 'streetlight-collector',
        title: 'Streetlight Collector',
        description: 'Capture 3 cities and build a constellation of night walks.',
        metric: 'cities',
        threshold: 3,
        accentStart: '#7ef7c0',
        accentEnd: '#1ba87a',
    },
    {
        id: 'border-breaker',
        title: 'Border Breaker',
        description: 'Unlock 5 total places across countries and cities.',
        metric: 'places',
        threshold: 5,
        accentStart: '#ffb870',
        accentEnd: '#ff6a3d',
    },
    {
        id: 'constellation-courier',
        title: 'Constellation Courier',
        description: 'Reach 5 countries and turn the globe into a route map of your own.',
        metric: 'countries',
        threshold: 5,
        accentStart: '#f3a3c2',
        accentEnd: '#dc4d88',
    },
    {
        id: 'skyline-archivist',
        title: 'Skyline Archivist',
        description: 'Collect 10 cities and turn skylines into souvenirs.',
        metric: 'cities',
        threshold: 10,
        accentStart: '#9be7ff',
        accentEnd: '#008db3',
    },
    {
        id: 'atlas-awakens',
        title: 'Atlas Awakens',
        description: 'Reach 20 unlocked places and make the planet feel alive in your hands.',
        metric: 'places',
        threshold: 20,
        accentStart: '#ffd56b',
        accentEnd: '#ff7f32',
    },
    {
        id: 'hemisphere-hopper',
        title: 'Hemisphere Hopper',
        description: 'Visit 12 countries and prove your compass never rests.',
        metric: 'countries',
        threshold: 12,
        accentStart: '#c0b4ff',
        accentEnd: '#5a59ff',
    },
    {
        id: 'world-carver',
        title: 'World Carver',
        description: 'Conquer 10% of the world and start leaving visible marks on the map.',
        metric: 'world-percent',
        threshold: 10,
        accentStart: '#6ef1b7',
        accentEnd: '#0d8a7d',
    },
    {
        id: 'continental-pulse',
        title: 'Continental Pulse',
        description: 'Conquer 25% of the world and let your route echo across continents.',
        metric: 'world-percent',
        threshold: 25,
        accentStart: '#ffb6a5',
        accentEnd: '#ff5e62',
    },
    {
        id: 'planet-whisperer',
        title: 'Planet Whisperer',
        description: 'Reach 60 total places and become one of the rare travelers the globe remembers.',
        metric: 'places',
        threshold: 60,
        accentStart: '#9fd1ff',
        accentEnd: '#6f7cff',
    },
];

function getAchievementMetricValue(metric: AchievementMetric, achievementMetrics: AchievementMetrics): number {
    if (metric === 'countries') return achievementMetrics.unlockedCountriesCount;
    if (metric === 'cities') return achievementMetrics.unlockedCitiesCount;
    if (metric === 'world-percent') return achievementMetrics.worldConqueredPercentage;
    return achievementMetrics.unlockedPlacesCount;
}

function getThresholdLabel(metric: AchievementMetric, threshold: number): string {
    if (metric === 'countries') return `${threshold} countries`;
    if (metric === 'cities') return `${threshold} cities`;
    if (metric === 'world-percent') return `${threshold}% conquered`;
    return `${threshold} places`;
}

function getProgressLabel(metric: AchievementMetric, value: number): string {
    if (metric === 'world-percent') {
        return `${Number(value.toFixed(1))}% of the world`;
    }

    if (metric === 'countries') return `${Math.floor(value)} countries logged`;
    if (metric === 'cities') return `${Math.floor(value)} cities captured`;
    return `${Math.floor(value)} places unlocked`;
}

function buildAchievementMonogram(title: string): string {
    return title
        .split(' ')
        .map((word) => word[0]?.toUpperCase() ?? '')
        .join('')
        .slice(0, 2);
}

export function buildAchievementImageDataUrl(definition: AchievementDefinition, unlocked: boolean): string {
    const monogram = buildAchievementMonogram(definition.title);
    const backgroundStart = unlocked ? definition.accentStart : '#040506';
    const backgroundEnd = unlocked ? definition.accentEnd : '#15171a';
    const rim = unlocked ? 'rgba(255,255,255,0.78)' : 'rgba(255,255,255,0.14)';
    const core = unlocked ? 'rgba(255,255,255,0.94)' : 'rgba(0,0,0,0.82)';
    const textColor = unlocked ? '#061018' : '#d7d9de';
    const sparkleOpacity = unlocked ? '0.85' : '0.24';
    const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" fill="none">
            <defs>
                <linearGradient id="achievement-bg" x1="30" y1="18" x2="210" y2="220" gradientUnits="userSpaceOnUse">
                    <stop stop-color="${backgroundStart}"/>
                    <stop offset="1" stop-color="${backgroundEnd}"/>
                </linearGradient>
                <radialGradient id="achievement-core" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(120 120) rotate(90) scale(90)">
                    <stop stop-color="${core}"/>
                    <stop offset="1" stop-color="rgba(255,255,255,0)"/>
                </radialGradient>
            </defs>
            <rect x="12" y="12" width="216" height="216" rx="54" fill="url(#achievement-bg)"/>
            <circle cx="120" cy="120" r="76" stroke="${rim}" stroke-width="3"/>
            <circle cx="120" cy="120" r="56" fill="url(#achievement-core)"/>
            <path d="M120 56L131.3 91.2H168.4L138.4 113L149.9 148.1L120 126.4L90.1 148.1L101.6 113L71.6 91.2H108.7L120 56Z" fill="${rim}" fill-opacity="${sparkleOpacity}"/>
            <circle cx="58" cy="74" r="6" fill="${rim}" fill-opacity="${sparkleOpacity}"/>
            <circle cx="185" cy="69" r="4" fill="${rim}" fill-opacity="${sparkleOpacity}"/>
            <circle cx="54" cy="169" r="4" fill="${rim}" fill-opacity="${sparkleOpacity}"/>
            <circle cx="186" cy="172" r="6" fill="${rim}" fill-opacity="${sparkleOpacity}"/>
            <text x="120" y="137" text-anchor="middle" font-family="'Segoe UI', sans-serif" font-size="42" font-weight="700" fill="${textColor}">${monogram}</text>
        </svg>
    `.trim();

    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export function buildAchievementCardViewModel(
    definition: AchievementDefinition,
    achievementMetrics: AchievementMetrics,
    unlocked: boolean,
): AchievementCardViewModel {
    const currentValue = getAchievementMetricValue(definition.metric, achievementMetrics);
    return {
        definition,
        currentValue,
        progressRatio: Math.min(currentValue / definition.threshold, 1),
        progressLabel: getProgressLabel(definition.metric, currentValue),
        thresholdLabel: getThresholdLabel(definition.metric, definition.threshold),
        imageUrl: buildAchievementImageDataUrl(definition, unlocked),
        unlocked,
    };
}

export function resolveUnlockedAchievementIds(
    achievementMetrics: AchievementMetrics,
    currentUnlockedAchievementIds: string[],
): string[] {
    const unlockedAchievementIdSet = new Set(currentUnlockedAchievementIds);

    for (const achievementDefinition of ACHIEVEMENT_DEFINITIONS) {
        const metricValue = getAchievementMetricValue(achievementDefinition.metric, achievementMetrics);
        if (metricValue >= achievementDefinition.threshold) {
            unlockedAchievementIdSet.add(achievementDefinition.id);
        }
    }

    return ACHIEVEMENT_DEFINITIONS.filter((achievementDefinition) =>
        unlockedAchievementIdSet.has(achievementDefinition.id),
    ).map((achievementDefinition) => achievementDefinition.id);
}
