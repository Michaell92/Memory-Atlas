<template>
    <Suspense>
        <RouterView />
        <template #fallback>
            <AppLoader label="Spinning up the globe…" />
        </template>
    </Suspense>
</template>

<script setup lang="ts">
import { RouterView } from 'vue-router';

import AppLoader from '@/shared/components/AppLoader.vue';

import '@/styles/global.scss';
</script>
