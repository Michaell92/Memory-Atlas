<template>
    <section class="achievements-panel">
        <div class="achievements-panel__header">
            <div>
                <p class="achievements-panel__eyebrow">Achievements</p>
                <h4 class="achievements-panel__title">Unlockable travel milestones</h4>
                <p class="achievements-panel__copy">
                    Locked relics stay dark until your next route pushes past a threshold.
                </p>
            </div>

            <div class="achievements-panel__summary-grid">
                <article class="achievements-panel__summary-card">
                    <strong>{{ unlockedCount }}/{{ achievementCards.length }}</strong>
                    <span>Unlocked</span>
                </article>
                <article class="achievements-panel__summary-card">
                    <strong>{{ unlockedPlacesCount }}</strong>
                    <span>Total places</span>
                </article>
                <article class="achievements-panel__summary-card">
                    <strong>{{ worldConqueredPercentage.toFixed(1) }}%</strong>
                    <span>World conquered</span>
                </article>
            </div>
        </div>

        <div class="achievements-panel__scroller">
            <article
                v-for="achievementCard in achievementCards"
                :key="achievementCard.definition.id"
                class="achievements-panel__card"
                :class="{ 'achievements-panel__card--locked': !achievementCard.unlocked }"
            >
                <img
                    class="achievements-panel__image"
                    :src="achievementCard.imageUrl"
                    :alt="`${achievementCard.definition.title} achievement emblem`"
                />

                <div class="achievements-panel__content">
                    <div class="achievements-panel__card-header">
                        <div>
                            <h5>{{ achievementCard.definition.title }}</h5>
                            <p>{{ achievementCard.definition.description }}</p>
                        </div>

                        <span class="achievements-panel__state">
                            {{ achievementCard.unlocked ? 'Unlocked' : 'Locked' }}
                        </span>
                    </div>

                    <div class="achievements-panel__meter-copy">
                        <span>{{ achievementCard.progressLabel }}</span>
                        <strong>{{ achievementCard.thresholdLabel }}</strong>
                    </div>

                    <div class="achievements-panel__meter" aria-hidden="true">
                        <span :style="{ width: `${achievementCard.progressRatio * 100}%` }" />
                    </div>
                </div>
            </article>
        </div>
    </section>
</template>

<script setup lang="ts">
import type { AchievementCardViewModel } from '@/modules/Achievements/types/achievement.types';

defineProps<{
    achievementCards: AchievementCardViewModel[];
    unlockedCount: number;
    unlockedPlacesCount: number;
    worldConqueredPercentage: number;
}>();
</script>

<style lang="scss" scoped>
.achievements-panel {
    display: grid;
    gap: 1.25rem;
    padding: 1.25rem;
    border-radius: 1.5rem;
    background:
        radial-gradient(circle at top left, color-mix(in srgb, var(--theme-accent) 18%, transparent), transparent 32%),
        rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.06);

    &__header {
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
        color: var(--theme-text-muted);
        line-height: 1.65;
    }

    &__summary-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 0.875rem;
    }

    &__summary-card {
        display: grid;
        gap: 0.25rem;
        padding: 1rem;
        border-radius: 1.125rem;
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.08);

        strong {
            font-size: 1.5rem;
            color: var(--theme-text);
        }

        span {
            color: var(--theme-text-muted);
        }
    }

    &__scroller {
        display: grid;
        gap: 0.875rem;
        max-height: 30rem;
        overflow: auto;
        padding-right: 0.25rem;
    }

    &__card {
        display: grid;
        grid-template-columns: auto 1fr;
        gap: 1rem;
        align-items: center;
        padding: 1rem;
        border-radius: 1.25rem;
        background: linear-gradient(135deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0.025));
        border: 1px solid rgba(255, 255, 255, 0.08);

        &--locked {
            background: linear-gradient(135deg, rgba(0, 0, 0, 0.42), rgba(255, 255, 255, 0.03));
            border-color: rgba(255, 255, 255, 0.04);

            .achievements-panel__image {
                filter: grayscale(1) brightness(0.42) contrast(1.15);
            }

            .achievements-panel__state {
                background: rgba(0, 0, 0, 0.28);
                color: #d7d9de;
            }
        }
    }

    &__image {
        width: 5.5rem;
        height: 5.5rem;
        border-radius: 1.25rem;
        flex: 0 0 auto;
        box-shadow: 0 0.75rem 2.5rem rgba(0, 0, 0, 0.26);
    }

    &__content {
        display: grid;
        gap: 0.75rem;
        min-width: 0;
    }

    &__card-header {
        display: flex;
        justify-content: space-between;
        gap: 1rem;
        align-items: flex-start;

        h5,
        p {
            margin: 0;
        }

        h5 {
            color: var(--theme-text);
            font-size: 1rem;
        }

        p {
            margin-top: 0.3rem;
            color: var(--theme-text-muted);
            line-height: 1.55;
        }
    }

    &__state {
        padding: 0.45rem 0.7rem;
        border-radius: 999rem;
        background: color-mix(in srgb, var(--theme-accent) 20%, rgba(255, 255, 255, 0.08));
        color: var(--theme-text);
        font-size: 0.72rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        white-space: nowrap;
    }

    &__meter-copy {
        display: flex;
        justify-content: space-between;
        gap: 1rem;
        align-items: center;
        color: var(--theme-text-muted);

        strong {
            color: var(--theme-text);
            font-size: 0.85rem;
        }
    }

    &__meter {
        height: 0.6rem;
        border-radius: 999rem;
        background: rgba(255, 255, 255, 0.08);
        overflow: hidden;

        span {
            display: block;
            height: 100%;
            border-radius: inherit;
            background: linear-gradient(90deg, var(--theme-accent), color-mix(in srgb, var(--theme-accent) 45%, white));
        }
    }
}

@media (max-width: 56rem) {
    .achievements-panel {
        &__summary-grid,
        &__card {
            grid-template-columns: 1fr;
        }

        &__card-header,
        &__meter-copy {
            flex-direction: column;
            align-items: flex-start;
        }

        &__image {
            width: 5rem;
            height: 5rem;
        }
    }
}
</style>
