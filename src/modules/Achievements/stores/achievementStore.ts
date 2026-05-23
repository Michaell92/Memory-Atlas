import { computed, ref } from 'vue';
import { defineStore } from 'pinia';

import type { Memory } from '@/modules/Memory/types/memory.types';
import type {
    AchievementCardViewModel,
    AchievementDefinition,
    AchievementMetrics,
} from '@/modules/Achievements/types/achievement.types';
import {
    ACHIEVEMENT_DEFINITIONS,
    DEFAULT_ACHIEVEMENT_METRICS,
    buildAchievementCardViewModel,
    resolveUnlockedAchievementIds,
} from '@/modules/Achievements/utils/achievementCatalog';
import { buildAchievementMetricsFromMemories } from '@/modules/Achievements/utils/achievementProgress';
import { useUserStore } from '@/modules/User/stores/userStore';

function areAchievementIdListsEqual(leftIds: string[], rightIds: string[]): boolean {
    if (leftIds.length !== rightIds.length) return false;
    return leftIds.every((achievementId, index) => achievementId === rightIds[index]);
}

export const useAchievementsStore = defineStore('achievements', () => {
    const userStore = useUserStore();
    const achievementMetrics = ref<AchievementMetrics>(DEFAULT_ACHIEVEMENT_METRICS);
    const celebrationQueue = ref<AchievementDefinition[]>([]);

    const unlockedAchievementIds = computed(
        () => userStore.currentUser?.settings.achievementState.unlockedAchievementIds ?? [],
    );
    const unlockedAchievements = computed(() =>
        ACHIEVEMENT_DEFINITIONS.filter((achievementDefinition) =>
            unlockedAchievementIds.value.includes(achievementDefinition.id),
        ),
    );
    const achievementCards = computed<AchievementCardViewModel[]>(() =>
        ACHIEVEMENT_DEFINITIONS.map((achievementDefinition) =>
            buildAchievementCardViewModel(
                achievementDefinition,
                achievementMetrics.value,
                unlockedAchievementIds.value.includes(achievementDefinition.id),
            ),
        ),
    );
    const activeCelebration = computed<AchievementCardViewModel | null>(() => {
        const achievementDefinition = celebrationQueue.value[0];
        if (!achievementDefinition) return null;
        return buildAchievementCardViewModel(achievementDefinition, achievementMetrics.value, true);
    });

    function syncProgressFromMemories(memories: Memory[], options: { announceNewUnlocks?: boolean } = {}): void {
        const currentUser = userStore.currentUser;
        achievementMetrics.value = buildAchievementMetricsFromMemories(memories);

        if (!currentUser) {
            celebrationQueue.value = [];
            return;
        }

        const currentUnlockedIds = currentUser.settings.achievementState.unlockedAchievementIds;
        const nextUnlockedIds = resolveUnlockedAchievementIds(achievementMetrics.value, currentUnlockedIds);
        const newlyUnlockedAchievements = ACHIEVEMENT_DEFINITIONS.filter(
            (achievementDefinition) =>
                nextUnlockedIds.includes(achievementDefinition.id) &&
                !currentUnlockedIds.includes(achievementDefinition.id),
        );

        if (!areAchievementIdListsEqual(currentUnlockedIds, nextUnlockedIds)) {
            userStore.updateCurrentUserSettings({
                achievementState: {
                    unlockedAchievementIds: nextUnlockedIds,
                    lastUnlockedAt:
                        newlyUnlockedAchievements.length > 0
                            ? new Date().toISOString()
                            : currentUser.settings.achievementState.lastUnlockedAt,
                },
            });
        }

        if ((options.announceNewUnlocks ?? true) && newlyUnlockedAchievements.length > 0) {
            celebrationQueue.value = [...celebrationQueue.value, ...newlyUnlockedAchievements];
        }
    }

    function dismissActiveCelebration(): void {
        celebrationQueue.value = celebrationQueue.value.slice(1);
    }

    function clearSessionState(): void {
        celebrationQueue.value = [];
        achievementMetrics.value = DEFAULT_ACHIEVEMENT_METRICS;
    }

    return {
        achievementMetrics,
        achievementCards,
        unlockedAchievementIds,
        unlockedAchievements,
        activeCelebration,
        syncProgressFromMemories,
        dismissActiveCelebration,
        clearSessionState,
    };
});
