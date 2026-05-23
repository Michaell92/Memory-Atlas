<template>
    <div ref="menuRootRef" class="user-identity-menu">
        <button type="button" class="user-identity-menu__trigger" @click="userStore.toggleUserMenu()">
            <span class="user-identity-menu__pulse" />
            {{ userStore.isAuthenticated ? userStore.displayName : 'Sign in' }}
        </button>

        <Transition name="user-identity-menu-dropdown">
            <div v-if="userStore.isUserMenuOpen && userStore.isAuthenticated" class="user-identity-menu__dropdown">
                <button type="button" class="user-identity-menu__item" @click="userStore.openPanel('overview')">
                    Profile
                </button>
                <button
                    type="button"
                    class="user-identity-menu__item user-identity-menu__item--muted"
                    @click="userStore.logoutUser()"
                >
                    Sign out
                </button>
            </div>
        </Transition>
    </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, useTemplateRef } from 'vue';

import { useUserStore } from '@/modules/User/stores/userStore';

const userStore = useUserStore();
const menuRootRef = useTemplateRef<HTMLDivElement>('menuRootRef');

function handleDocumentPointerDown(event: PointerEvent): void {
    if (!userStore.isUserMenuOpen) return;
    if (!menuRootRef.value) return;
    if (menuRootRef.value.contains(event.target as Node)) return;
    userStore.closeUserMenu();
}

onMounted(() => {
    document.addEventListener('pointerdown', handleDocumentPointerDown);
});

onUnmounted(() => {
    document.removeEventListener('pointerdown', handleDocumentPointerDown);
});
</script>

<style lang="scss" scoped>
.user-identity-menu {
    position: absolute;
    top: 1rem;
    right: 1rem;
    z-index: 25;

    &__trigger {
        display: inline-flex;
        align-items: center;
        gap: 0.625rem;
        min-height: 2.875rem;
        padding: 0 1rem;
        border: 1px solid color-mix(in srgb, var(--theme-accent) 22%, transparent);
        border-radius: 999rem;
        background: color-mix(in srgb, var(--theme-surface) 82%, rgba(2, 3, 10, 0.55));
        color: var(--theme-text);
        font: inherit;
        cursor: pointer;
        backdrop-filter: blur(1rem) saturate(1.2);
        transition:
            transform 180ms ease,
            box-shadow 180ms ease,
            border-color 180ms ease;

        &:hover {
            transform: translateY(-0.125rem);
            border-color: color-mix(in srgb, var(--theme-accent) 44%, transparent);
            box-shadow: 0 0.75rem 1.5rem rgba(0, 0, 0, 0.18);
        }
    }

    &__pulse {
        width: 0.625rem;
        height: 0.625rem;
        border-radius: 50%;
        background: var(--theme-accent);
        box-shadow: 0 0 1rem color-mix(in srgb, var(--theme-accent) 55%, transparent);
    }

    &__dropdown {
        position: absolute;
        top: calc(100% + 0.625rem);
        right: 0;
        display: grid;
        gap: 0.375rem;
        min-width: 11rem;
        padding: 0.625rem;
        border-radius: 1rem;
        background: color-mix(in srgb, var(--theme-surface) 88%, #02030a);
        border: 1px solid color-mix(in srgb, var(--theme-accent) 18%, transparent);
        box-shadow: 0 1rem 2rem rgba(0, 0, 0, 0.22);
        backdrop-filter: blur(1rem);
    }

    &__item {
        min-height: 2.75rem;
        padding: 0 0.875rem;
        border: 0;
        border-radius: 0.875rem;
        background: rgba(255, 255, 255, 0.03);
        color: var(--theme-text);
        text-align: left;
        font: inherit;
        cursor: pointer;

        &:hover {
            background: color-mix(in srgb, var(--theme-accent-soft) 88%, rgba(255, 255, 255, 0.03));
        }

        &--muted {
            color: var(--theme-text-muted);
        }
    }
}

.user-identity-menu-dropdown-enter-active,
.user-identity-menu-dropdown-leave-active {
    transition:
        opacity 180ms ease,
        transform 180ms ease;
}

.user-identity-menu-dropdown-enter-from,
.user-identity-menu-dropdown-leave-to {
    opacity: 0;
    transform: translateY(-0.25rem);
}
</style>
