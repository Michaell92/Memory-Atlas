<template>
    <div class="globe-view">
        <canvas ref="canvasRef" class="globe-view__canvas" />
    </div>
</template>

<script setup vapor lang="ts">
import { useTemplateRef } from 'vue';

import { useGlobeScene } from '@/modules/Globe/composables/useGlobeScene';

const canvasRef = useTemplateRef<HTMLCanvasElement>('canvasRef');

useGlobeScene(canvasRef);
</script>

<style lang="scss" scoped>
.globe-view {
    @include absolute-fill;

    &__canvas {
        width: 100%;
        height: 100%;
        display: block;
    }
}
</style>
