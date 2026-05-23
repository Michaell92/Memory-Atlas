<template>
    <Teleport to="body">
        <Transition name="achievement-unlock">
            <section
                v-if="activeCelebration"
                class="achievement-unlock"
                @pointermove="handlePointerMove"
                @pointerleave="resetPointerDepth"
                @click="dismissCelebration"
            >
                <div class="achievement-unlock__backdrop" aria-hidden="true" />

                <div class="achievement-unlock__burst" aria-hidden="true">
                    <span v-for="sparkIndex in 12" :key="sparkIndex" :style="sparkStyles[sparkIndex - 1]" />
                </div>

                <article ref="cardElement" class="achievement-unlock__card" @click.stop>
                    <p class="achievement-unlock__eyebrow">Achievement unlocked</p>
                    <img
                        ref="imageElement"
                        class="achievement-unlock__image"
                        :src="activeCelebration.imageUrl"
                        :alt="`${activeCelebration.definition.title} achievement emblem`"
                    />
                    <h3 class="achievement-unlock__title">{{ activeCelebration.definition.title }}</h3>
                    <p class="achievement-unlock__copy">{{ activeCelebration.definition.description }}</p>

                    <div class="achievement-unlock__meta">
                        <span>{{ activeCelebration.progressLabel }}</span>
                        <strong>{{ activeCelebration.thresholdLabel }}</strong>
                    </div>

                    <button type="button" class="achievement-unlock__button" @click="dismissCelebration">
                        Continue exploring
                    </button>
                </article>
            </section>
        </Transition>
    </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { gsap } from 'gsap';

import { useAchievementsStore } from '@/modules/Achievements/stores/achievementStore';

const achievementsStore = useAchievementsStore();

const activeCelebration = computed(() => achievementsStore.activeCelebration);
const cardElement = ref<HTMLElement | null>(null);
const imageElement = ref<HTMLImageElement | null>(null);
const dismissTimerId = ref<number | null>(null);
const sparkStyles = Array.from({ length: 12 }, (_, index) => ({
    transform: `rotate(${index * 30}deg) translateY(-11rem)`,
}));

function clearDismissTimer(): void {
    if (dismissTimerId.value === null) return;
    window.clearTimeout(dismissTimerId.value);
    dismissTimerId.value = null;
}

function dismissCelebration(): void {
    clearDismissTimer();
    achievementsStore.dismissActiveCelebration();
}

function resetPointerDepth(): void {
    if (!cardElement.value || !imageElement.value) return;

    gsap.to(cardElement.value, {
        rotateX: 0,
        rotateY: 0,
        x: 0,
        y: 0,
        duration: 0.45,
        ease: 'power3.out',
    });
    gsap.to(imageElement.value, {
        x: 0,
        y: 0,
        duration: 0.45,
        ease: 'power3.out',
    });
}

function handlePointerMove(event: PointerEvent): void {
    if (!cardElement.value || !imageElement.value) return;

    const cardBounds = cardElement.value.getBoundingClientRect();
    const xOffsetRatio = (event.clientX - (cardBounds.left + cardBounds.width / 2)) / cardBounds.width;
    const yOffsetRatio = (event.clientY - (cardBounds.top + cardBounds.height / 2)) / cardBounds.height;

    gsap.to(cardElement.value, {
        rotateY: xOffsetRatio * 14,
        rotateX: yOffsetRatio * -10,
        x: xOffsetRatio * 12,
        y: yOffsetRatio * 12,
        duration: 0.25,
        ease: 'power2.out',
    });
    gsap.to(imageElement.value, {
        x: xOffsetRatio * 18,
        y: yOffsetRatio * 18,
        duration: 0.3,
        ease: 'power2.out',
    });
}

watch(
    activeCelebration,
    async (nextCelebration) => {
        clearDismissTimer();
        if (!nextCelebration) return;

        await nextTick();
        if (!cardElement.value || !imageElement.value) return;

        gsap.killTweensOf([cardElement.value, imageElement.value]);
        gsap.set(cardElement.value, {
            opacity: 0,
            scale: 0.84,
            y: 48,
            rotateX: -16,
            transformPerspective: 1200,
        });
        gsap.set(imageElement.value, { scale: 0.6, opacity: 0, rotate: -18 });

        const timeline = gsap.timeline();
        timeline.to(cardElement.value, {
            opacity: 1,
            scale: 1,
            y: 0,
            rotateX: 0,
            duration: 0.8,
            ease: 'power4.out',
        });
        timeline.to(
            imageElement.value,
            {
                opacity: 1,
                scale: 1,
                rotate: 0,
                duration: 0.72,
                ease: 'back.out(1.8)',
            },
            '-=0.48',
        );

        dismissTimerId.value = window.setTimeout(() => {
            dismissCelebration();
        }, 5200);
    },
    { flush: 'post' },
);

onBeforeUnmount(() => {
    clearDismissTimer();
});
</script>

<style lang="scss" scoped>
.achievement-unlock {
    position: fixed;
    inset: 0;
    z-index: 60;
    display: grid;
    place-items: center;
    padding: 1.5rem;
    overflow: hidden;

    &__backdrop {
        position: absolute;
        inset: 0;
        background: radial-gradient(circle at center, rgba(255, 255, 255, 0.1), transparent 38%), rgba(2, 4, 10, 0.72);
        backdrop-filter: blur(1rem) saturate(1.2);
    }

    &__burst {
        position: absolute;
        width: 28rem;
        height: 28rem;
        pointer-events: none;

        span {
            position: absolute;
            top: 50%;
            left: 50%;
            width: 0.2rem;
            height: 8rem;
            border-radius: 999rem;
            background: linear-gradient(
                180deg,
                rgba(255, 255, 255, 0),
                rgba(255, 255, 255, 0.72),
                rgba(255, 255, 255, 0)
            );
            transform-origin: center center;
            opacity: 0.45;
        }
    }

    &__card {
        position: relative;
        z-index: 1;
        width: min(34rem, 100%);
        display: grid;
        justify-items: center;
        gap: 1rem;
        padding: 2rem;
        border-radius: 2rem;
        background:
            radial-gradient(circle at top, color-mix(in srgb, var(--theme-accent) 22%, transparent), transparent 42%),
            linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(7, 14, 28, 0.96));
        border: 1px solid rgba(255, 255, 255, 0.1);
        box-shadow: 0 2rem 5rem rgba(0, 0, 0, 0.45);
        text-align: center;
        transform-style: preserve-3d;
    }

    &__eyebrow {
        margin: 0;
        font-size: 0.8rem;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        color: var(--theme-text-muted);
    }

    &__image {
        width: 9rem;
        height: 9rem;
        border-radius: 2rem;
        box-shadow: 0 1.25rem 3.5rem rgba(0, 0, 0, 0.32);
    }

    &__title {
        margin: 0;
        color: var(--theme-text);
        font-size: clamp(1.8rem, 4vw, 2.6rem);
    }

    &__copy {
        margin: 0;
        max-width: 26rem;
        color: var(--theme-text-muted);
        line-height: 1.7;
    }

    &__meta {
        display: flex;
        justify-content: center;
        gap: 1rem;
        flex-wrap: wrap;
        color: var(--theme-text-muted);

        strong {
            color: var(--theme-text);
        }
    }

    &__button {
        min-height: 3rem;
        padding: 0 1.2rem;
        border: 0;
        border-radius: 999rem;
        background: linear-gradient(135deg, var(--theme-accent), color-mix(in srgb, var(--theme-accent) 54%, white));
        color: #081119;
        font: inherit;
        font-weight: 700;
        cursor: pointer;
    }
}

.achievement-unlock-enter-active,
.achievement-unlock-leave-active {
    transition: opacity 220ms ease;
}

.achievement-unlock-enter-from,
.achievement-unlock-leave-to {
    opacity: 0;
}

@media (max-width: 40rem) {
    .achievement-unlock {
        &__card {
            padding: 1.5rem;
        }

        &__image {
            width: 7.5rem;
            height: 7.5rem;
        }
    }
}
</style>
