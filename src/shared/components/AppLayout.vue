<template>
    <div class="app-layout">
        <UserIdentityMenu />
        <main class="app-layout__stage">
            <RouterView />
        </main>
        <UserAuthModal />
        <UserPanel />
    </div>
</template>

<script setup lang="ts">
import { onMounted, watch } from 'vue';
import { RouterView } from 'vue-router';

import { useMemoryStore } from '@/modules/Memory/stores/memoryStore';
import UserAuthModal from '@/modules/User/components/UserAuthModal.vue';
import UserIdentityMenu from '@/modules/User/components/UserIdentityMenu.vue';
import UserPanel from '@/modules/User/components/UserPanel.vue';
import { useUserStore } from '@/modules/User/stores/userStore';

const userStore = useUserStore();
const memoryStore = useMemoryStore();

function applyThemeVariables(): void {
    const rootElement = document.documentElement;
    const themePalette = userStore.currentThemePalette;

    rootElement.style.setProperty('--app-background-start', themePalette.ui.backgroundStart);
    rootElement.style.setProperty('--app-background-mid', themePalette.ui.backgroundMid);
    rootElement.style.setProperty('--app-background-end', themePalette.ui.backgroundEnd);
    rootElement.style.setProperty('--theme-surface', themePalette.ui.surface);
    rootElement.style.setProperty('--theme-surface-border', themePalette.ui.surfaceBorder);
    rootElement.style.setProperty('--theme-accent', themePalette.ui.accent);
    rootElement.style.setProperty('--theme-accent-soft', themePalette.ui.accentSoft);
    rootElement.style.setProperty('--theme-text', themePalette.ui.text);
    rootElement.style.setProperty('--theme-text-muted', themePalette.ui.textMuted);
}

watch(
    () => userStore.currentUserId,
    (currentUserId) => {
        if (!currentUserId) return;
        memoryStore.ensureMemoriesForUser(currentUserId);
    },
    { immediate: true },
);

watch(
    () => userStore.currentThemePalette,
    () => {
        applyThemeVariables();
    },
    { immediate: true },
);

onMounted(() => {
    applyThemeVariables();
});
</script>

<style lang="scss" scoped>
.app-layout {
    position: relative;
    width: 100%;
    height: 100%;
    background: radial-gradient(
        ellipse at 50% 40%,
        var(--app-background-start) 0%,
        var(--app-background-mid) 55%,
        var(--app-background-end) 100%
    );
    overflow: hidden;

    &__stage {
        @include absolute-fill;
        z-index: $z-canvas;
    }
}
</style>
