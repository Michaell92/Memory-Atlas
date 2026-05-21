<template>
    <section class="chat-widget" :class="{ 'chat-widget--open': chatStore.isWidgetOpen }">
        <button
            v-if="!chatStore.isWidgetOpen"
            type="button"
            class="chat-widget__launcher"
            @click="chatStore.openWidget()"
        >
            <span class="chat-widget__launcher-glow" aria-hidden="true" />
            <span class="chat-widget__launcher-label">Chat</span>
            <span class="chat-widget__launcher-caption">Atlas Lounge</span>
        </button>

        <div v-if="chatStore.isWidgetOpen" class="chat-widget__panel">
            <header class="chat-widget__header">
                <div>
                    <p class="chat-widget__eyebrow">Live room</p>
                    <h2 class="chat-widget__title">{{ chatStore.activeRoom?.title ?? 'Chat' }}</h2>
                    <p class="chat-widget__description">
                        {{ chatStore.activeRoom?.description }}
                    </p>
                </div>

                <button type="button" class="chat-widget__close" @click="chatStore.closeWidget()">✕</button>
            </header>

            <div ref="messageViewportRef" class="chat-widget__messages" aria-live="polite">
                <ChatMessageList :messages="chatStore.activeRoomMessages" :current-user-id="userStore.currentUserId" />
            </div>

            <footer class="chat-widget__composer">
                <p class="chat-widget__presence">
                    <span class="chat-widget__presence-dot" />
                    {{ userStore.isAuthenticated ? `Posting as ${userStore.displayName}` : 'Read-only until login' }}
                </p>

                <ChatComposer
                    v-model="draftMessage"
                    :disabled="!userStore.isAuthenticated"
                    @submit="submitMessage"
                    @insert-emoji="insertEmoji"
                    @request-auth="userStore.openAuthDialog('login')"
                />
            </footer>
        </div>
    </section>
</template>

<script setup lang="ts">
import { nextTick, ref, useTemplateRef, watch } from 'vue';

import ChatComposer from '@/modules/Chat/components/ChatComposer.vue';
import ChatMessageList from '@/modules/Chat/components/ChatMessageList.vue';
import { useChatStore } from '@/modules/Chat/stores/chatStore';
import { useUserStore } from '@/modules/User/stores/userStore';

const chatStore = useChatStore();
const userStore = useUserStore();
const draftMessage = ref('');
const messageViewportRef = useTemplateRef<HTMLDivElement>('messageViewportRef');

function scrollMessagesToBottom(): void {
    if (!messageViewportRef.value) return;
    messageViewportRef.value.scrollTop = messageViewportRef.value.scrollHeight;
}

function insertEmoji(emoji: string): void {
    draftMessage.value = `${draftMessage.value}${emoji}`;
}

function submitMessage(): void {
    if (!userStore.isAuthenticated || !userStore.currentUserId) return;

    const createdMessage = chatStore.sendMessage({
        authorUserId: userStore.currentUserId,
        authorDisplayName: userStore.displayName,
        content: draftMessage.value,
    });

    if (!createdMessage) return;

    draftMessage.value = '';
}

watch(
    () => [chatStore.isWidgetOpen, chatStore.activeRoomMessages.length],
    async ([isWidgetOpen]) => {
        if (!isWidgetOpen) return;
        await nextTick();
        scrollMessagesToBottom();
    },
    { immediate: true },
);
</script>

<style lang="scss" scoped>
.chat-widget {
    position: absolute;
    right: 1rem;
    bottom: 1rem;
    z-index: 30;
    pointer-events: none;

    &__launcher,
    &__panel {
        pointer-events: auto;
    }

    &__launcher {
        position: relative;
        display: grid;
        gap: 0.15rem;
        min-width: 10rem;
        padding: 0.95rem 1rem 0.95rem 1.15rem;
        border: 1px solid color-mix(in srgb, var(--theme-accent) 22%, transparent);
        border-radius: 1.4rem;
        background: color-mix(in srgb, var(--theme-surface) 86%, rgba(2, 3, 10, 0.62));
        color: var(--theme-text);
        text-align: left;
        cursor: pointer;
        overflow: hidden;
        box-shadow: 0 1rem 2.5rem rgba(0, 0, 0, 0.24);
        backdrop-filter: blur(1rem) saturate(1.25);
    }

    &__launcher-glow {
        position: absolute;
        inset: auto auto -1.8rem -1.8rem;
        width: 5rem;
        height: 5rem;
        border-radius: 50%;
        background: color-mix(in srgb, var(--theme-accent) 30%, transparent);
        filter: blur(1rem);
    }

    &__launcher-label {
        position: relative;
        font-size: 1rem;
        font-weight: 700;
    }

    &__launcher-caption {
        position: relative;
        font-size: 0.78rem;
        color: var(--theme-text-muted);
    }

    &__panel {
        width: min(24rem, calc(100vw - 2rem));
        height: min(38rem, calc(100vh - 2rem));
        display: grid;
        grid-template-rows: auto minmax(0, 1fr) auto;
        gap: 1rem;
        padding: 1rem;
        border-radius: 1.7rem;
        border: 1px solid color-mix(in srgb, var(--theme-accent) 16%, transparent);
        background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0.02)),
            color-mix(in srgb, var(--theme-surface) 90%, #02030a);
        box-shadow: 0 1.5rem 4rem rgba(0, 0, 0, 0.3);
        backdrop-filter: blur(1.4rem) saturate(1.35);
    }

    &__header {
        display: flex;
        justify-content: space-between;
        gap: 1rem;
        align-items: flex-start;
    }

    &__eyebrow {
        margin: 0 0 0.3rem;
        font-size: 0.7rem;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--theme-text-muted);
    }

    &__title {
        margin: 0;
        font-size: 1.15rem;
        color: var(--theme-text);
    }

    &__description {
        margin: 0.35rem 0 0;
        font-size: 0.8rem;
        line-height: 1.45;
        color: var(--theme-text-muted);
    }

    &__close {
        width: 2.5rem;
        height: 2.5rem;
        border: 0;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.05);
        color: var(--theme-text);
        cursor: pointer;
    }

    &__messages {
        min-height: 0;
        padding-right: 0.25rem;
        overflow: auto;
    }

    &__composer {
        display: grid;
        gap: 0.75rem;
    }

    &__presence {
        display: inline-flex;
        align-items: center;
        gap: 0.45rem;
        margin: 0;
        font-size: 0.76rem;
        color: var(--theme-text-muted);
    }

    &__presence-dot {
        width: 0.55rem;
        height: 0.55rem;
        border-radius: 50%;
        background: var(--theme-accent);
        box-shadow: 0 0 0.9rem color-mix(in srgb, var(--theme-accent) 60%, transparent);
    }
}

@media (max-width: 48rem) {
    .chat-widget {
        right: 0.75rem;
        left: 0.75rem;
        bottom: 0.75rem;

        &__launcher,
        &__panel {
            width: 100%;
        }

        &__panel {
            height: min(34rem, calc(100vh - 1.5rem));
        }
    }
}
</style>
