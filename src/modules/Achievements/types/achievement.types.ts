export type AchievementMetric = 'countries' | 'cities' | 'places' | 'world-percent';

export interface AchievementDefinition {
    id: string;
    title: string;
    description: string;
    metric: AchievementMetric;
    threshold: number;
    accentStart: string;
    accentEnd: string;
}

export interface AchievementMetrics {
    unlockedCountriesCount: number;
    unlockedCitiesCount: number;
    unlockedPlacesCount: number;
    worldConqueredPercentage: number;
}

export interface AchievementState {
    unlockedAchievementIds: string[];
    lastUnlockedAt: string | null;
}

export interface AchievementCardViewModel {
    definition: AchievementDefinition;
    currentValue: number;
    progressRatio: number;
    progressLabel: string;
    thresholdLabel: string;
    imageUrl: string;
    unlocked: boolean;
}
