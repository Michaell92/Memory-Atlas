import { computed, ref } from 'vue';
import { defineStore } from 'pinia';

import { chatLocalGateway } from '@/modules/Chat/services/chatLocalGateway';
import type { ChatMessageRecord, SendChatMessagePayload } from '@/modules/Chat/types/chat.types';

const MAX_LOCAL_MESSAGES_PER_ROOM = 250;

function generateChatMessageId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return `chat-${crypto.randomUUID()}`;
    }

    return `chat-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeMessageContent(content: string): string {
    return content.replace(/\r\n/g, '\n').trim();
}

const persistedSnapshot = chatLocalGateway.load();

export const useChatStore = defineStore('chat', () => {
    const rooms = ref(persistedSnapshot.rooms);
    const messages = ref(persistedSnapshot.messages);
    const activeRoomId = ref(persistedSnapshot.activeRoomId);
    const isWidgetOpen = ref(persistedSnapshot.isWidgetOpen);

    const activeRoom = computed(() => rooms.value.find((room) => room.id === activeRoomId.value) ?? null);
    const activeRoomMessages = computed(() =>
        messages.value
            .filter((message) => message.roomId === activeRoomId.value)
            .sort((leftMessage, rightMessage) => leftMessage.sentAt.localeCompare(rightMessage.sentAt)),
    );

    function persistChatState(): void {
        chatLocalGateway.save({
            rooms: rooms.value,
            messages: messages.value,
            activeRoomId: activeRoomId.value,
            isWidgetOpen: isWidgetOpen.value,
        });
    }

    function clampRoomMessages(roomId: string): void {
        const roomMessages = messages.value.filter((message) => message.roomId === roomId);
        if (roomMessages.length <= MAX_LOCAL_MESSAGES_PER_ROOM) return;

        const retainedMessageIds = new Set(
            roomMessages.slice(roomMessages.length - MAX_LOCAL_MESSAGES_PER_ROOM).map((message) => message.id),
        );

        messages.value = messages.value.filter(
            (message) => message.roomId !== roomId || retainedMessageIds.has(message.id),
        );
    }

    function openWidget(): void {
        isWidgetOpen.value = true;
        persistChatState();
    }

    function closeWidget(): void {
        isWidgetOpen.value = false;
        persistChatState();
    }

    function toggleWidget(): void {
        isWidgetOpen.value = !isWidgetOpen.value;
        persistChatState();
    }

    function setActiveRoom(roomId: string): void {
        if (!rooms.value.some((room) => room.id === roomId)) return;
        activeRoomId.value = roomId;
        persistChatState();
    }

    function sendMessage(payload: SendChatMessagePayload): ChatMessageRecord | null {
        const normalizedContent = normalizeMessageContent(payload.content);
        if (normalizedContent.length === 0) return null;

        const roomId = payload.roomId ?? activeRoomId.value;
        if (!rooms.value.some((room) => room.id === roomId)) return null;

        const createdMessage: ChatMessageRecord = {
            id: generateChatMessageId(),
            roomId,
            authorUserId: payload.authorUserId,
            authorDisplayName: payload.authorDisplayName.trim() || 'Traveler',
            content: normalizedContent,
            sentAt: new Date().toISOString(),
        };

        messages.value = [...messages.value, createdMessage];
        clampRoomMessages(roomId);
        persistChatState();
        return createdMessage;
    }

    return {
        rooms,
        messages,
        activeRoomId,
        activeRoom,
        activeRoomMessages,
        isWidgetOpen,
        openWidget,
        closeWidget,
        toggleWidget,
        setActiveRoom,
        sendMessage,
    };
});
