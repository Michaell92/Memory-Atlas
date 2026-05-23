<template>
    <div class="globe-info-buttons">
        <button
            ref="placesButtonRef"
            type="button"
            class="globe-info-buttons__button globe-info-buttons__button--places"
            @mouseenter="handlePlacesHoverEnter"
            @mouseleave="handlePlacesHoverLeave"
            @click="handlePlacesClick"
        >
            <span ref="placesOrbitRef" class="globe-info-buttons__orbit" aria-hidden="true">
                <span />
                <span />
                <span />
            </span>
            <span class="globe-info-buttons__eyebrow">Atlas footprint</span>
            <strong>{{ totalPlacesVisited }}</strong>
            <span class="globe-info-buttons__label">Total places visited</span>
        </button>

        <button
            ref="achievementsButtonRef"
            type="button"
            class="globe-info-buttons__button globe-info-buttons__button--achievements"
            @mouseenter="handleAchievementsHoverEnter"
            @mouseleave="handleAchievementsHoverLeave"
            @click="handleAchievementsClick"
        >
            <span ref="achievementsBurstRef" class="globe-info-buttons__burst" aria-hidden="true">
                <span v-for="sparkIndex in 8" :key="sparkIndex" :style="burstStyles[sparkIndex - 1]" />
            </span>
            <span class="globe-info-buttons__eyebrow">Vault unlocked</span>
            <strong>{{ totalAchievementsUnlocked }}</strong>
            <span class="globe-info-buttons__label">Achievements unlocked</span>
        </button>
    </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, useTemplateRef } from 'vue';
import { gsap } from 'gsap';

const props = defineProps<{
    totalPlacesVisited: number;
    totalAchievementsUnlocked: number;
}>();

const placesButtonRef = useTemplateRef<HTMLButtonElement>('placesButtonRef');
const placesOrbitRef = useTemplateRef<HTMLSpanElement>('placesOrbitRef');
const achievementsButtonRef = useTemplateRef<HTMLButtonElement>('achievementsButtonRef');
const achievementsBurstRef = useTemplateRef<HTMLSpanElement>('achievementsBurstRef');

const burstStyles = Array.from({ length: 8 }, (_, index) => ({
    transform: `rotate(${index * 45}deg) translateY(-3.2rem)`,
}));

function animateHoverEnter(buttonElement: HTMLButtonElement | null, options: { y: number; rotate: number }): void {
    if (!buttonElement) return;

    gsap.killTweensOf(buttonElement);
    gsap.to(buttonElement, {
        y: options.y,
        rotateZ: options.rotate,
        scale: 1.035,
        duration: 0.28,
        ease: 'power2.out',
    });
}

function animateHoverLeave(buttonElement: HTMLButtonElement | null): void {
    if (!buttonElement) return;

    gsap.killTweensOf(buttonElement);
    gsap.to(buttonElement, {
        y: 0,
        rotateZ: 0,
        scale: 1,
        duration: 0.32,
        ease: 'power3.out',
    });
}

function handlePlacesHoverEnter(): void {
    const placesButtonElement = placesButtonRef.value;
    const placesOrbitElement = placesOrbitRef.value;

    animateHoverEnter(placesButtonElement, { y: -4, rotate: -0.75 });
    if (!placesOrbitElement) return;

    gsap.killTweensOf(placesOrbitElement);
    gsap.to(placesOrbitElement, {
        rotate: '+=24',
        scale: 1.04,
        opacity: 1,
        duration: 0.45,
        ease: 'power2.out',
    });
}

function handlePlacesHoverLeave(): void {
    animateHoverLeave(placesButtonRef.value);
    if (!placesOrbitRef.value) return;

    gsap.killTweensOf(placesOrbitRef.value);
    gsap.to(placesOrbitRef.value, {
        scale: 1,
        opacity: 0.72,
        duration: 0.35,
        ease: 'power2.out',
    });
}

function handlePlacesClick(): void {
    const placesButtonElement = placesButtonRef.value;
    const placesOrbitElement = placesOrbitRef.value;
    if (!placesButtonElement || !placesOrbitElement) return;

    gsap.killTweensOf([placesButtonElement, placesOrbitElement]);
    const timeline = gsap.timeline();
    timeline.to(placesButtonElement, {
        keyframes: [
            { scale: 0.95, duration: 0.08 },
            { scale: 1.07, duration: 0.14 },
            { scale: 1, duration: 0.26 },
        ],
        ease: 'power2.out',
    });
    timeline.to(
        placesOrbitElement,
        {
            keyframes: [
                { rotate: '+=120', scale: 1.18, duration: 0.35 },
                { rotate: '+=240', scale: 1, duration: 0.55 },
            ],
            ease: 'power3.out',
        },
        0,
    );
}

function handleAchievementsHoverEnter(): void {
    const achievementsButtonElement = achievementsButtonRef.value;
    const achievementsBurstElement = achievementsBurstRef.value;

    animateHoverEnter(achievementsButtonElement, { y: -5, rotate: 0.75 });
    if (!achievementsBurstElement) return;

    gsap.killTweensOf(achievementsBurstElement.children);
    gsap.to(achievementsBurstElement.children, {
        y: -4,
        opacity: 0.85,
        scaleY: 1.08,
        stagger: 0.02,
        duration: 0.24,
        ease: 'power2.out',
    });
}

function handleAchievementsHoverLeave(): void {
    animateHoverLeave(achievementsButtonRef.value);
    if (!achievementsBurstRef.value) return;

    gsap.killTweensOf(achievementsBurstRef.value.children);
    gsap.to(achievementsBurstRef.value.children, {
        y: 0,
        opacity: 0.32,
        scaleY: 1,
        stagger: 0.015,
        duration: 0.26,
        ease: 'power2.out',
    });
}

function handleAchievementsClick(): void {
    const achievementsButtonElement = achievementsButtonRef.value;
    const achievementsBurstElement = achievementsBurstRef.value;
    if (!achievementsButtonElement || !achievementsBurstElement) return;

    gsap.killTweensOf([achievementsButtonElement, achievementsBurstElement.children]);
    const timeline = gsap.timeline();
    timeline.to(achievementsButtonElement, {
        keyframes: [
            { rotateZ: -2, y: -2, duration: 0.07 },
            { rotateZ: 2.4, y: -7, duration: 0.11 },
            { rotateZ: 0, y: 0, duration: 0.3 },
        ],
        ease: 'power2.out',
    });
    timeline.fromTo(
        achievementsBurstElement.children,
        { opacity: 0.35, scaleY: 0.4, y: 0 },
        {
            keyframes: [
                { opacity: 1, scaleY: 1.55, y: -16, duration: 0.16 },
                { opacity: 0.18, scaleY: 0.8, y: -2, duration: 0.4 },
            ],
            stagger: 0.03,
            ease: 'power3.out',
        },
        0,
    );
}

onBeforeUnmount(() => {
    if (placesButtonRef.value) gsap.killTweensOf(placesButtonRef.value);
    if (placesOrbitRef.value) gsap.killTweensOf(placesOrbitRef.value);
    if (achievementsButtonRef.value) gsap.killTweensOf(achievementsButtonRef.value);
    if (achievementsBurstRef.value) gsap.killTweensOf(achievementsBurstRef.value.children);
    void props;
});
</script>

<style lang="scss" scoped>
.globe-info-buttons {
    position: absolute;
    top: 1rem;
    left: 50%;
    z-index: 8;
    display: flex;
    gap: 0.9rem;
    transform: translateX(-50%);
    pointer-events: none;

    &__button {
        position: relative;
        min-width: 11.5rem;
        display: grid;
        justify-items: center;
        gap: 0.18rem;
        padding: 0.95rem 1.2rem 1rem;
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 1.4rem;
        background:
            radial-gradient(circle at top, rgba(255, 255, 255, 0.12), transparent 52%),
            rgba(4, 11, 22, 0.72);
        box-shadow: 0 1rem 2.5rem rgba(0, 0, 0, 0.24);
        backdrop-filter: blur(1rem) saturate(1.2);
        color: var(--theme-text);
        cursor: pointer;
        overflow: hidden;
        pointer-events: auto;
        transform-origin: center center;

        strong {
            position: relative;
            z-index: 1;
            font-size: 1.45rem;
            line-height: 1;
        }
    }

    &__eyebrow,
    &__label {
        position: relative;
        z-index: 1;
    }

    &__eyebrow {
        font-size: 0.68rem;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: var(--theme-text-muted);
    }

    &__label {
        font-size: 0.82rem;
        color: color-mix(in srgb, var(--theme-text) 82%, var(--theme-text-muted));
    }

    &__button--places {
        background:
            radial-gradient(circle at top, rgba(115, 211, 255, 0.18), transparent 50%),
            linear-gradient(180deg, rgba(7, 18, 36, 0.88), rgba(4, 11, 22, 0.75));
    }

    &__button--achievements {
        background:
            radial-gradient(circle at top, rgba(255, 184, 112, 0.18), transparent 50%),
            linear-gradient(180deg, rgba(30, 15, 10, 0.88), rgba(18, 10, 10, 0.75));
    }

    &__orbit,
    &__burst {
        position: absolute;
        inset: 0;
        pointer-events: none;
    }

    &__orbit {
        opacity: 0.72;

        span {
            position: absolute;
            inset: 0.45rem;
            border-radius: 1.15rem;
            border: 1px solid rgba(115, 211, 255, 0.18);

            &:nth-child(2) {
                inset: 0.7rem 1rem;
                border-color: rgba(115, 211, 255, 0.3);
            }

            &:nth-child(3) {
                inset: 0.95rem 1.8rem;
                border-color: rgba(126, 247, 192, 0.24);
            }
        }
    }

    &__burst {
        span {
            position: absolute;
            top: 50%;
            left: 50%;
            width: 0.18rem;
            height: 2.75rem;
            border-radius: 999rem;
            background: linear-gradient(180deg, rgba(255, 255, 255, 0), rgba(255, 184, 112, 0.92), rgba(255, 255, 255, 0));
            transform-origin: center center;
            opacity: 0.32;
        }
    }
}

@media (max-width: 42rem) {
    .globe-info-buttons {
        top: 0.8rem;
        width: min(100% - 1rem, 26rem);
        gap: 0.55rem;

        &__button {
            min-width: 0;
            flex: 1 1 0;
            padding: 0.85rem 0.75rem 0.95rem;
        }

        strong {
            font-size: 1.2rem;
        }

        &__label {
            font-size: 0.75rem;
        }
    }
}
</style>