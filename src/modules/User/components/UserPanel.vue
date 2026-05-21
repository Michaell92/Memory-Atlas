<template>
    <Teleport to="body">
        <Transition name="user-panel">
            <div v-if="userStore.activePanelSection" class="user-panel" @click.self="userStore.closePanel()">
                <div class="user-panel__backdrop" aria-hidden="true" />

                <aside class="user-panel__sheet">
                    <header class="user-panel__header">
                        <div>
                            <p class="user-panel__eyebrow">Traveler space</p>
                            <h2 class="user-panel__title">{{ userStore.displayName }}</h2>
                        </div>

                        <button type="button" class="user-panel__close" @click="userStore.closePanel()">✕</button>
                    </header>

                    <nav class="user-panel__tabs">
                        <button
                            type="button"
                            class="user-panel__tab"
                            :class="{ 'user-panel__tab--active': userStore.activePanelSection === 'profile' }"
                            @click="userStore.openPanel('profile')"
                        >
                            Profile
                        </button>
                        <button
                            type="button"
                            class="user-panel__tab"
                            :class="{ 'user-panel__tab--active': userStore.activePanelSection === 'settings' }"
                            @click="userStore.openPanel('settings')"
                        >
                            Settings
                        </button>
                    </nav>

                    <div class="user-panel__content">
                        <UserProfileSection v-if="userStore.activePanelSection === 'profile'" />
                        <UserSettingsSection v-else />
                    </div>
                </aside>
            </div>
        </Transition>
    </Teleport>
</template>

<script setup lang="ts">
import UserProfileSection from '@/modules/User/components/UserProfileSection.vue';
import UserSettingsSection from '@/modules/User/components/UserSettingsSection.vue';
import { useUserStore } from '@/modules/User/stores/userStore';

const userStore = useUserStore();
</script>

<style lang="scss" scoped>
.user-panel {
    position: fixed;
    inset: 0;
    z-index: 45;
    display: flex;
    justify-content: flex-end;
    padding: 1rem;

    &__backdrop {
        position: absolute;
        inset: 0;
        background: rgba(2, 3, 10, 0.38);
        backdrop-filter: blur(0.75rem);
    }

    &__sheet {
        position: relative;
        z-index: 1;
        width: min(62rem, 100%);
        height: 100%;
        display: grid;
        grid-template-rows: auto auto 1fr;
        gap: 1rem;
        padding: 1.25rem;
        border-radius: 1.75rem;
        background: color-mix(in srgb, var(--theme-surface) 88%, #02030a);
        border: 1px solid color-mix(in srgb, var(--theme-accent) 18%, transparent);
        box-shadow: 0 1rem 3rem rgba(0, 0, 0, 0.35);
        backdrop-filter: blur(1.5rem) saturate(1.35);
        overflow: hidden;
    }

    &__header {
        display: flex;
        justify-content: space-between;
        gap: 1rem;
        align-items: flex-start;
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
        font-size: clamp(1.75rem, 3vw, 2.75rem);
    }

    &__close {
        width: 2.75rem;
        height: 2.75rem;
        border: 0;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.06);
        color: var(--theme-text);
        font-size: 1.25rem;
        cursor: pointer;
    }

    &__tabs {
        display: inline-grid;
        grid-template-columns: repeat(2, minmax(0, max-content));
        gap: 0.5rem;
    }

    &__tab {
        min-height: 2.75rem;
        padding: 0 1rem;
        border: 0;
        border-radius: 999rem;
        background: rgba(255, 255, 255, 0.05);
        color: var(--theme-text-muted);
        font: inherit;
        cursor: pointer;

        &--active {
            background: color-mix(in srgb, var(--theme-accent-soft) 88%, rgba(255, 255, 255, 0.04));
            color: var(--theme-text);
        }
    }

    &__content {
        min-height: 0;
        overflow: auto;
        padding-right: 0.25rem;
    }
}

.user-panel-enter-active,
.user-panel-leave-active {
    transition: opacity 220ms ease;
}

.user-panel-enter-active .user-panel__sheet,
.user-panel-leave-active .user-panel__sheet {
    transition: transform 220ms ease;
}

.user-panel-enter-from,
.user-panel-leave-to {
    opacity: 0;

    .user-panel__sheet {
        transform: translateX(1.5rem);
    }
}

@media (max-width: 56rem) {
    .user-panel {
        padding: 0;

        &__sheet {
            width: 100%;
            border-radius: 0;
        }
    }
}
</style>
