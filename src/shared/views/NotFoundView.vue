<template>
    <section class="not-found">
        <div class="not-found__content">
            <p class="not-found__eyebrow">404 · uncharted territory</p>
            <h1 class="not-found__title">Lost in space</h1>
            <p class="not-found__body">
                This memory hasn't been written yet. Drift back to the globe and pick another star.
            </p>
            <RouterLink to="/" class="not-found__cta">Return to the globe</RouterLink>
        </div>
    </section>
</template>

<script setup vapor lang="ts">
import { RouterLink } from 'vue-router';
</script>

<style lang="scss" scoped>
.not-found {
    @include absolute-fill;
    @include flex-center;
    color: $color-text;
    padding: $space-xl;

    &__content {
        text-align: center;
        max-width: 30rem;
    }

    &__eyebrow {
        margin: 0 0 $space-sm;
        font-size: $font-size-xs;
        letter-spacing: 0.25rem;
        text-transform: uppercase;
        color: $color-text-muted;
    }

    &__title {
        margin: 0 0 $space-md;
        font-family: $font-display;
        font-size: $font-size-2xl;
        font-weight: 600;
        @include text-glow($color-aurora, 0.75rem);
    }

    &__body {
        margin: 0 0 $space-xl;
        color: $color-text-muted;
        line-height: 1.6;
    }

    &__cta {
        display: inline-block;
        padding: $space-sm $space-lg;
        border: 1px solid rgba($color-aurora, 0.4);
        border-radius: $radius-pill;
        color: $color-aurora;
        transition: all $duration-base $ease-cinematic;

        &:hover {
            @include glow($color-aurora, 1.25rem);
            border-color: $color-aurora;
            background: rgba($color-aurora, 0.08);
        }
    }
}
</style>
