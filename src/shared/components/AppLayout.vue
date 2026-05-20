<template>
    <div class="app-layout">
        <main class="app-layout__stage">
            <RouterView />
        </main>
    </div>
</template>

<script setup vapor lang="ts">
import { RouterView } from 'vue-router';
</script>

<style lang="scss" scoped>
.app-layout {
    position: relative;
    width: 100%;
    height: 100%;
    background: radial-gradient(ellipse at 50% 40%, $color-nebula 0%, $color-deep-space 55%, $color-void 100%);
    overflow: hidden;

    &__stage {
        @include absolute-fill;
        z-index: $z-canvas;
    }
}
</style>
