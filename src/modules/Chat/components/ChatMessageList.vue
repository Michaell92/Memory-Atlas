<template>
    <div class="chat-message-list">
        <div v-if="messages.length === 0" class="chat-message-list__empty">
            <p>No messages yet.</p>
            <span>Start the room with a quick hello, reaction, or travel update.</span>
        </div>

        <article
            v-for="message in messages"
            :key="message.id"
            class="chat-message-list__item"
            :class="{ 'chat-message-list__item--mine': message.authorUserId === currentUserId }"
        >
            <p class="chat-message-list__meta">
                <strong>{{ message.authorDisplayName }}</strong>
                <span>{{ formatChatTimestamp(message.sentAt) }}</span>
            </p>
            <div class="chat-message-list__bubble">
                {{ message.content }}
            </div>
        </article>
    </div>
</template>

<script setup lang="ts">
import { formatChatTimestamp } from '@/modules/Chat/utils/chatFormatting';
import type { ChatMessageRecord } from '@/modules/Chat/types/chat.types';

defineProps<{
    messages: ChatMessageRecord[];
    currentUserId: string | null;
}>();
</script>

<style lang="scss" scoped>
.chat-message-list {
    display: grid;
    align-content: start;
    gap: 0.875rem;
    min-height: 100%;

    &__empty {
        display: grid;
        gap: 0.375rem;
        align-content: center;
        min-height: 100%;
        padding: 1.5rem;
        border: 1px dashed color-mix(in srgb, var(--theme-accent) 20%, transparent);
        border-radius: 1.25rem;
        text-align: center;
        color: var(--theme-text-muted);

        p {
            margin: 0;
            color: var(--theme-text);
        }

        span {
            line-height: 1.5;
        }
    }

    &__item {
        display: grid;
        justify-items: start;
        gap: 0.35rem;

        &--mine {
            justify-items: end;

            .chat-message-list__bubble {
                background: linear-gradient(
                    135deg,
                    color-mix(in srgb, var(--theme-accent) 28%, rgba(255, 255, 255, 0.08)),
                    color-mix(in srgb, var(--theme-accent-soft) 95%, rgba(255, 255, 255, 0.04))
                );
                border-color: color-mix(in srgb, var(--theme-accent) 32%, transparent);
            }
        }
    }

    &__meta {
        display: flex;
        flex-wrap: wrap;
        gap: 0.4rem;
        margin: 0;
        font-size: 0.7rem;
        color: var(--theme-text-muted);

        strong {
            font-weight: 600;
            color: var(--theme-text);
        }
    }

    &__bubble {
        max-width: min(19rem, 100%);
        padding: 0.8rem 0.95rem;
        border-radius: 1.1rem;
        border: 1px solid rgba(255, 255, 255, 0.08);
        background: rgba(255, 255, 255, 0.04);
        color: var(--theme-text);
        line-height: 1.5;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
        box-shadow: 0 0.625rem 1.5rem rgba(0, 0, 0, 0.14);
    }
}
</style>
