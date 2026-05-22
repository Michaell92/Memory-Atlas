<template>
    <Teleport to="body">
        <Transition name="confirm-dialog">
            <div
                v-if="isOpen"
                class="confirm-dialog"
                role="dialog"
                aria-modal="true"
                :aria-label="title"
                @click.self="$emit('cancel')"
            >
                <div class="confirm-dialog__backdrop" aria-hidden="true" />

                <section class="confirm-dialog__panel">
                    <p class="confirm-dialog__eyebrow">Confirm</p>
                    <h2 class="confirm-dialog__title">{{ title }}</h2>
                    <p class="confirm-dialog__message">{{ message }}</p>

                    <div class="confirm-dialog__actions">
                        <button
                            type="button"
                            class="confirm-dialog__button confirm-dialog__button--secondary"
                            @click="$emit('cancel')"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            class="confirm-dialog__button confirm-dialog__button--danger"
                            @click="$emit('confirm')"
                        >
                            {{ confirmLabel }}
                        </button>
                    </div>
                </section>
            </div>
        </Transition>
    </Teleport>
</template>

<script setup lang="ts">
withDefaults(
    defineProps<{
        isOpen: boolean;
        title: string;
        message: string;
        confirmLabel?: string;
    }>(),
    {
        confirmLabel: 'Delete memory',
    },
);

defineEmits<{
    confirm: [];
    cancel: [];
}>();
</script>

<style lang="scss" scoped>
.confirm-dialog {
    position: fixed;
    inset: 0;
    z-index: 60;
    display: grid;
    place-items: center;
    padding: 1rem;

    &__backdrop {
        position: absolute;
        inset: 0;
        background: rgba(2, 3, 10, 0.62);
        backdrop-filter: blur(1rem);
    }

    &__panel {
        position: relative;
        z-index: 1;
        width: min(28rem, 100%);
        display: grid;
        gap: 0.875rem;
        padding: 1.25rem;
        border-radius: 1.5rem;
        background: color-mix(in srgb, var(--theme-surface) 92%, #02030a);
        border: 1px solid color-mix(in srgb, var(--theme-accent) 18%, transparent);
        box-shadow: 0 1.5rem 3rem rgba(0, 0, 0, 0.32);
    }

    &__eyebrow {
        margin: 0;
        font-size: 0.75rem;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--theme-text-muted);
    }

    &__title {
        margin: 0;
        color: var(--theme-text);
        font-size: 1.35rem;
    }

    &__message {
        margin: 0;
        color: var(--theme-text-muted);
        line-height: 1.6;
    }

    &__actions {
        display: flex;
        justify-content: flex-end;
        gap: 0.75rem;
        margin-top: 0.25rem;
    }

    &__button {
        min-height: 2.75rem;
        padding: 0 1rem;
        border-radius: 999rem;
        font: inherit;
        cursor: pointer;

        &--secondary {
            border: 1px solid rgba(255, 255, 255, 0.1);
            background: rgba(255, 255, 255, 0.04);
            color: var(--theme-text);
        }

        &--danger {
            border: 1px solid rgba(255, 124, 124, 0.24);
            background: linear-gradient(135deg, rgba(255, 98, 98, 0.22), rgba(255, 160, 160, 0.14));
            color: #fff2f2;
        }
    }
}

.confirm-dialog-enter-active,
.confirm-dialog-leave-active {
    transition: opacity 180ms ease;
}

.confirm-dialog-enter-active .confirm-dialog__panel,
.confirm-dialog-leave-active .confirm-dialog__panel {
    transition: transform 180ms ease;
}

.confirm-dialog-enter-from,
.confirm-dialog-leave-to {
    opacity: 0;

    .confirm-dialog__panel {
        transform: translateY(0.5rem);
    }
}
</style>
