import type { Memory } from '@/modules/Memory/types/memory.types';

import type { AchievementMetrics } from '@/modules/Achievements/types/achievement.types';
import {
    DEFAULT_ACHIEVEMENT_METRICS,
    TOTAL_WORLD_COUNTRY_COUNT,
} from '@/modules/Achievements/utils/achievementCatalog';

function normalizeCountryKey(memory: Pick<Memory, 'countryCode' | 'countryName'>): string {
    return memory.countryCode.trim().toLocaleLowerCase() || memory.countryName.trim().toLocaleLowerCase();
}

function normalizeCityKey(memory: Pick<Memory, 'countryCode' | 'countryName' | 'cityId' | 'cityName'>): string {
    const countryKey = normalizeCountryKey(memory);
    const cityKey = memory.cityId?.trim().toLocaleLowerCase() || memory.cityName?.trim().toLocaleLowerCase() || '';
    if (!cityKey) return '';
    return `${countryKey}:${cityKey}`;
}

export function buildAchievementMetricsFromMemories(memories: Memory[]): AchievementMetrics {
    if (memories.length === 0) return DEFAULT_ACHIEVEMENT_METRICS;

    const unlockedCountryKeys = new Set<string>();
    const unlockedCityKeys = new Set<string>();

    for (const memory of memories) {
        const countryKey = normalizeCountryKey(memory);
        if (countryKey) unlockedCountryKeys.add(countryKey);

        const cityKey = normalizeCityKey(memory);
        if (cityKey) unlockedCityKeys.add(cityKey);
    }

    const unlockedCountriesCount = unlockedCountryKeys.size;
    const unlockedCitiesCount = unlockedCityKeys.size;

    return {
        unlockedCountriesCount,
        unlockedCitiesCount,
        unlockedPlacesCount: unlockedCountriesCount + unlockedCitiesCount,
        worldConqueredPercentage: Number(((unlockedCountriesCount / TOTAL_WORLD_COUNTRY_COUNT) * 100).toFixed(1)),
    };
}
