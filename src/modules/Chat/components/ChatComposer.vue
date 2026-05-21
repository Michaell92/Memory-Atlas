<template>
    <div class="chat-composer">
        <div class="chat-composer__emoji-row" aria-label="Quick emojis">
            <button
                v-for="emoji in quickEmojis"
                :key="emoji"
                type="button"
                class="chat-composer__emoji"
                :disabled="disabled"
                @click="$emit('insertEmoji', emoji)"
            >
                {{ emoji }}
            </button>
        </div>

        <div v-if="disabled" class="chat-composer__signed-out">
            <p>Sign in to join the lounge.</p>
            <button type="button" class="chat-composer__sign-in" @click="$emit('requestAuth')">Open login</button>
        </div>

        <div v-else class="chat-composer__input-shell">
            <textarea
                :value="modelValue"
                class="chat-composer__input"
                rows="3"
                placeholder="Write a message... emojis work here too"
                @input="handleInput"
                @keydown="handleKeydown"
            />
            <div class="chat-composer__footer">
                <span class="chat-composer__hint">Enter sends · Shift+Enter adds a new line</span>
                <button type="button" class="chat-composer__send" @click="$emit('submit')">Send</button>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
const quickEmojis = ['🌍', '✨', '🔥', '😂', '😍', '🧭'];

defineProps<{
    modelValue: string;
    disabled: boolean;
}>();

const emit = defineEmits<{
    (event: 'update:modelValue', value: string): void;
    (event: 'submit'): void;
    (event: 'insertEmoji', value: string): void;
    (event: 'requestAuth'): void;
}>();

function handleInput(event: Event): void {
    const target = event.target as HTMLTextAreaElement;
    emit('update:modelValue', target.value);
}

function handleKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter' || event.shiftKey) return;
    event.preventDefault();
    emit('submit');
}
</script>

<style lang="scss" scoped>
.chat-composer {
    display: grid;
    gap: 0.875rem;

    &__emoji-row {
        display: flex;
        gap: 0.4rem;
        flex-wrap: wrap;
    }

    &__emoji {
        width: 2.25rem;
        height: 2.25rem;
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 0.8rem;
        background: rgba(255, 255, 255, 0.04);
        cursor: pointer;
        font-size: 1rem;
        transition:
            transform 160ms ease,
            border-color 160ms ease,
            background 160ms ease;

        &:hover:enabled {
            transform: translateY(-0.0625rem);
            border-color: color-mix(in srgb, var(--theme-accent) 28%, transparent);
            background: color-mix(in srgb, var(--theme-accent-soft) 90%, rgba(255, 255, 255, 0.04));
        }
    }

    &__signed-out,
    &__input-shell {
        display: grid;
        gap: 0.75rem;
        padding: 0.875rem;
        border-radius: 1.2rem;
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.06);
    }

    &__signed-out {
        p {
            margin: 0;
            color: var(--theme-text-muted);
        }
    }

    &__sign-in,
    &__send {
        min-height: 2.75rem;
        padding: 0 1rem;
        border: 0;
        border-radius: 999rem;
        background: color-mix(in srgb, var(--theme-accent) 28%, rgba(255, 255, 255, 0.05));
        color: var(--theme-text);
        font: inherit;
        cursor: pointer;
    }

    &__input {
        width: 100%;
        resize: none;
        border: 0;
        background: transparent;
        color: var(--theme-text);
        font: inherit;
        line-height: 1.5;

        &:focus {
            outline: none;
        }
    }

    &__footer {
        display: flex;
        justify-content: space-between;
        gap: 0.75rem;
        align-items: center;
    }

    &__hint {
        font-size: 0.72rem;
        color: var(--theme-text-muted);
    }
}
</style>
