<template>
    <Teleport to="body">
        <Transition name="user-auth-modal">
            <div v-if="userStore.isAuthDialogOpen" class="user-auth-modal" @click.self="handleBackdropClick">
                <div class="user-auth-modal__backdrop" aria-hidden="true" />

                <section class="user-auth-modal__panel" role="dialog" aria-modal="true" aria-label="User access">
                    <div class="user-auth-modal__hero">
                        <p class="user-auth-modal__eyebrow">Memory Atlas</p>
                        <h2 class="user-auth-modal__title">Keep every trip tied to one traveler.</h2>
                        <p class="user-auth-modal__copy">
                            Local auth for now, shaped so the gateway can later swap to a real backend without changing
                            the UI contracts.
                        </p>

                        <div class="user-auth-modal__theme-pill">
                            <span class="user-auth-modal__theme-dot" />
                            {{ userStore.currentThemePalette.name }}
                        </div>
                    </div>

                    <div class="user-auth-modal__form-panel">
                        <div class="user-auth-modal__tabs">
                            <button
                                type="button"
                                class="user-auth-modal__tab"
                                :class="{ 'user-auth-modal__tab--active': userStore.authDialogMode === 'register' }"
                                @click="userStore.setAuthDialogMode('register')"
                            >
                                Register
                            </button>
                            <button
                                type="button"
                                class="user-auth-modal__tab"
                                :class="{ 'user-auth-modal__tab--active': userStore.authDialogMode === 'login' }"
                                @click="userStore.setAuthDialogMode('login')"
                            >
                                Login
                            </button>
                        </div>

                        <form class="user-auth-modal__form" @submit.prevent="submitForm">
                            <label v-if="userStore.authDialogMode === 'register'" class="user-auth-modal__field">
                                <span>Full name</span>
                                <input v-model="registrationFullName" type="text" placeholder="Luna Rivera" />
                            </label>

                            <label class="user-auth-modal__field">
                                <span>Email</span>
                                <input v-model="email" type="email" placeholder="traveler@example.com" />
                            </label>

                            <label class="user-auth-modal__field">
                                <span>Password</span>
                                <input v-model="password" type="password" placeholder="At least 6 characters" />
                            </label>

                            <label v-if="userStore.authDialogMode === 'register'" class="user-auth-modal__field">
                                <span>Confirm password</span>
                                <input v-model="passwordConfirmation" type="password" placeholder="Repeat password" />
                            </label>

                            <p v-if="feedbackMessage" class="user-auth-modal__feedback">{{ feedbackMessage }}</p>

                            <button type="submit" class="user-auth-modal__submit">
                                {{
                                    userStore.authDialogMode === 'register' ? 'Create traveler profile' : 'Enter atlas'
                                }}
                            </button>
                        </form>
                    </div>
                </section>
            </div>
        </Transition>
    </Teleport>
</template>

<script setup lang="ts">
import { ref } from 'vue';

import { useUserStore } from '@/modules/User/stores/userStore';

const userStore = useUserStore();

const registrationFullName = ref('');
const email = ref('');
const password = ref('');
const passwordConfirmation = ref('');
const feedbackMessage = ref('');

function resetForm(): void {
    registrationFullName.value = '';
    email.value = '';
    password.value = '';
    passwordConfirmation.value = '';
    feedbackMessage.value = '';
}

function handleBackdropClick(): void {
    if (!userStore.isAuthenticated && userStore.users.length === 0) return;
    userStore.closeAuthDialog();
    resetForm();
}

function submitForm(): void {
    feedbackMessage.value = '';

    if (userStore.authDialogMode === 'register') {
        if (password.value !== passwordConfirmation.value) {
            feedbackMessage.value = 'Passwords need to match.';
            return;
        }

        const result = userStore.registerUser({
            fullName: registrationFullName.value,
            email: email.value,
            password: password.value,
        });

        if (!result.ok) {
            feedbackMessage.value = result.message ?? 'Could not create the account.';
            return;
        }

        resetForm();
        return;
    }

    const result = userStore.loginUser({
        email: email.value,
        password: password.value,
    });

    if (!result.ok) {
        feedbackMessage.value = result.message ?? 'Could not log in.';
        return;
    }

    resetForm();
}
</script>

<style lang="scss" scoped>
.user-auth-modal {
    position: fixed;
    inset: 0;
    z-index: 50;
    display: grid;
    place-items: center;
    padding: 1rem;

    &__backdrop {
        position: absolute;
        inset: 0;
        background:
            radial-gradient(circle at top, color-mix(in srgb, var(--theme-accent) 12%, transparent), transparent 50%),
            rgba(2, 3, 10, 0.68);
        backdrop-filter: blur(1.25rem);
    }

    &__panel {
        position: relative;
        z-index: 1;
        width: min(58rem, 100%);
        display: grid;
        grid-template-columns: 1.1fr 0.9fr;
        overflow: hidden;
        border-radius: 1.75rem;
        border: 1px solid color-mix(in srgb, var(--theme-accent) 18%, transparent);
        background: color-mix(in srgb, var(--theme-surface) 84%, #02030a);
        box-shadow: 0 1.5rem 4rem rgba(0, 0, 0, 0.38);
        backdrop-filter: blur(1.75rem) saturate(1.4);
    }

    &__hero {
        display: grid;
        align-content: space-between;
        gap: 1.25rem;
        min-height: 28rem;
        padding: 2rem;
        background:
            linear-gradient(160deg, color-mix(in srgb, var(--theme-accent) 18%, transparent), transparent 58%),
            radial-gradient(circle at top left, rgba(255, 255, 255, 0.1), transparent 45%);
    }

    &__eyebrow {
        margin: 0;
        color: var(--theme-text-muted);
        font-size: 0.8125rem;
        letter-spacing: 0.14em;
        text-transform: uppercase;
    }

    &__title {
        margin: 0;
        font-size: clamp(2rem, 5vw, 3.5rem);
        line-height: 0.96;
        color: var(--theme-text);
    }

    &__copy {
        margin: 0;
        max-width: 26rem;
        color: var(--theme-text-muted);
        font-size: 1rem;
        line-height: 1.65;
    }

    &__theme-pill {
        display: inline-flex;
        align-items: center;
        gap: 0.625rem;
        width: fit-content;
        padding: 0.625rem 0.875rem;
        border-radius: 999rem;
        background: rgba(255, 255, 255, 0.06);
        color: var(--theme-text);
    }

    &__theme-dot {
        width: 0.625rem;
        height: 0.625rem;
        border-radius: 50%;
        background: var(--theme-accent);
        box-shadow: 0 0 1rem color-mix(in srgb, var(--theme-accent) 60%, transparent);
    }

    &__form-panel {
        display: grid;
        gap: 1.25rem;
        padding: 2rem;
    }

    &__tabs {
        display: inline-grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        padding: 0.25rem;
        border-radius: 999rem;
        background: rgba(255, 255, 255, 0.04);
    }

    &__tab {
        min-height: 2.75rem;
        border: 0;
        border-radius: 999rem;
        background: transparent;
        color: var(--theme-text-muted);
        font: inherit;
        cursor: pointer;
        transition:
            background 180ms ease,
            color 180ms ease,
            transform 180ms ease;

        &--active {
            background: color-mix(in srgb, var(--theme-accent-soft) 88%, rgba(255, 255, 255, 0.04));
            color: var(--theme-text);
            transform: translateY(-0.0625rem);
        }
    }

    &__form {
        display: grid;
        gap: 1rem;
    }

    &__field {
        display: grid;
        gap: 0.5rem;
        color: var(--theme-text-muted);
        font-size: 0.875rem;

        input {
            min-height: 3rem;
            padding: 0 0.875rem;
            border-radius: 1rem;
            border: 1px solid rgba(255, 255, 255, 0.08);
            background: rgba(255, 255, 255, 0.04);
            color: var(--theme-text);
            font: inherit;

            &:focus {
                outline: none;
                border-color: color-mix(in srgb, var(--theme-accent) 54%, transparent);
                box-shadow: 0 0 0 0.125rem color-mix(in srgb, var(--theme-accent) 14%, transparent);
            }
        }
    }

    &__feedback {
        margin: 0;
        padding: 0.875rem 1rem;
        border-radius: 1rem;
        background: rgba(255, 132, 132, 0.08);
        color: #ffc9c9;
    }

    &__submit {
        min-height: 3.25rem;
        border: 0;
        border-radius: 1rem;
        background: linear-gradient(135deg, var(--theme-accent), color-mix(in srgb, var(--theme-accent) 50%, white));
        color: #081119;
        font: inherit;
        font-weight: 700;
        cursor: pointer;
        transition:
            transform 180ms ease,
            box-shadow 180ms ease;

        &:hover {
            transform: translateY(-0.125rem);
            box-shadow: 0 0.75rem 2rem color-mix(in srgb, var(--theme-accent) 24%, transparent);
        }
    }
}

.user-auth-modal-enter-active,
.user-auth-modal-leave-active {
    transition:
        opacity 220ms ease,
        transform 220ms ease;
}

.user-auth-modal-enter-from,
.user-auth-modal-leave-to {
    opacity: 0;

    .user-auth-modal__panel {
        transform: translateY(1rem) scale(0.98);
    }
}

@media (max-width: 52rem) {
    .user-auth-modal {
        &__panel {
            grid-template-columns: 1fr;
        }

        &__hero {
            min-height: auto;
        }
    }
}
</style>
