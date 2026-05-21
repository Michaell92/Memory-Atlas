<template>
    <div class="app-loader" role="status" aria-live="polite">
        <div class="app-loader__orbit">
            <div class="app-loader__core" />
        </div>
        <p class="app-loader__label">{{ label }}</p>
    </div>
</template>

<script setup vapor lang="ts">
withDefaults(defineProps<{ label?: string }>(), { label: 'Loading orbit…' });
</script>

<style lang="scss" scoped>
.app-loader {
    @include absolute-fill;
    @include flex-center;
    flex-direction: column;
    gap: $space-md;
    color: $color-text-muted;
    background: $color-deep-space;
    z-index: $z-modal;

    &__orbit {
        position: relative;
        width: 3rem;
        height: 3rem;
        border-radius: 50%;
        border: 1px solid rgba($color-aurora, 0.25);
        animation: app-loader-spin 2.4s linear infinite;
        will-change: transform;
    }

    &__core {
        position: absolute;
        top: -0.25rem;
        left: 50%;
        width: 0.5rem;
        height: 0.5rem;
        margin-left: -0.25rem;
        border-radius: 50%;
        background: $color-aurora;
        @include glow($color-aurora, 0.75rem);
    }

    &__label {
        margin: 0;
        font-size: $font-size-xs;
        letter-spacing: 0.2rem;
        text-transform: uppercase;
    }
}

@keyframes app-loader-spin {
    to {
        transform: rotate(360deg);
    }
}
</style>
