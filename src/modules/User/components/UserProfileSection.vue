<template>
    <section class="user-profile-section">
        <header class="user-profile-section__hero">
            <div>
                <p class="user-profile-section__eyebrow">Profile</p>
                <h3 class="user-profile-section__title">{{ userStore.displayName }}'s memory vault</h3>
                <p class="user-profile-section__copy">
                    Curate the globe with places that matter, then keep refining each memory card as the story grows.
                </p>

                <div class="user-profile-section__location-ribbon">
                    <div class="user-profile-section__location-badge user-profile-section__location-badge--current">
                        <span>Current location</span>
                        <strong>{{ currentLocationLabel }}</strong>
                    </div>
                    <div class="user-profile-section__location-badge">
                        <span>Home base</span>
                        <strong>{{ homeCountryLabel }}</strong>
                    </div>
                </div>
            </div>

            <div class="user-profile-section__stats">
                <article class="user-profile-section__stat-card">
                    <strong>{{ memories.length }}</strong>
                    <span>Total memories</span>
                </article>
                <article class="user-profile-section__stat-card">
                    <strong>{{ uniqueCountriesCount }}</strong>
                    <span>Countries logged</span>
                </article>
                <article class="user-profile-section__stat-card">
                    <strong>{{ uniqueCitiesCount }}</strong>
                    <span>Cities captured</span>
                </article>
            </div>
        </header>

        <AchievementsPanel
            :achievement-cards="achievementCards"
            :unlocked-count="unlockedAchievementCount"
            :unlocked-places-count="unlockedPlacesCount"
            :world-conquered-percentage="worldConqueredPercentage"
        />
    </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import AchievementsPanel from '@/modules/Achievements/components/AchievementsPanel.vue';
import { useAchievementsStore } from '@/modules/Achievements/stores/achievementStore';
import { useMemoryStore } from '@/modules/Memory/stores/memoryStore';
import { useUserStore } from '@/modules/User/stores/userStore';

const achievementsStore = useAchievementsStore();
const memoryStore = useMemoryStore();
const userStore = useUserStore();

const memories = computed(() => memoryStore.memories);
const uniqueCountriesCount = computed(() => memoryStore.uniqueCountriesCount);
const uniqueCitiesCount = computed(() => memoryStore.uniqueCitiesCount);
const unlockedPlacesCount = computed(() => memoryStore.unlockedPlacesCount);
const achievementCards = computed(() => achievementsStore.achievementCards);
const unlockedAchievementCount = computed(() => achievementsStore.unlockedAchievementIds.length);
const worldConqueredPercentage = computed(() => achievementsStore.achievementMetrics.worldConqueredPercentage);
const currentLocationLabel = computed(() => {
    const currentLocation = userStore.currentLocation;
    if (!currentLocation) return 'Not set yet';
    return currentLocation.cityName
        ? `${currentLocation.cityName}, ${currentLocation.countryName}`
        : currentLocation.countryName;
});
const homeCountryLabel = computed(() => {
    const settings = userStore.currentUser?.settings;
    if (!settings?.homeCountryName) return 'Not set yet';
    return settings.homeCityName ? `${settings.homeCityName}, ${settings.homeCountryName}` : settings.homeCountryName;
});
</script>

<style lang="scss" scoped>
.user-profile-section {
    display: grid;
    gap: 1.5rem;

    &__hero {
        padding: 1.25rem;
        border-radius: 1.5rem;
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.06);
    }

    &__hero {
        display: grid;
        gap: 1rem;
    }

    &__eyebrow {
        margin: 0 0 0.5rem;
        font-size: 0.75rem;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--theme-text-muted);
    }

    &__title {
        margin: 0;
        color: var(--theme-text);
    }

    &__copy {
        margin: 0.5rem 0 0;
        max-width: 40rem;
        color: var(--theme-text-muted);
        line-height: 1.65;
    }

    &__location-ribbon {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, max-content));
        gap: 0.75rem;
        margin-top: 1rem;
    }

    &__location-badge {
        display: grid;
        gap: 0.2rem;
        padding: 0.875rem 1rem;
        border-radius: 1rem;
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.08);

        span {
            font-size: 0.7rem;
            letter-spacing: 0.1em;
            text-transform: uppercase;
            color: var(--theme-text-muted);
        }

        strong {
            color: var(--theme-text);
        }

        &--current {
            border-color: color-mix(in srgb, #ff5a5a 24%, transparent);
            background: linear-gradient(135deg, rgba(255, 90, 90, 0.14), rgba(255, 255, 255, 0.04));
        }
    }

    &__stats {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 0.875rem;
    }

    &__stat-card {
        display: grid;
        gap: 0.25rem;
        padding: 1rem;
        border-radius: 1.125rem;
        background: color-mix(in srgb, var(--theme-accent-soft) 78%, rgba(255, 255, 255, 0.04));
        border: 1px solid color-mix(in srgb, var(--theme-accent) 18%, transparent);

        strong {
            font-size: 1.75rem;
            color: var(--theme-text);
        }

        span {
            color: var(--theme-text-muted);
        }
    }
}

@media (max-width: 56rem) {
    .user-profile-section {
        &__stats {
            grid-template-columns: 1fr;
        }

        &__location-ribbon {
            grid-template-columns: 1fr;
        }
    }
}
</style>
