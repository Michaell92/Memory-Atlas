import type { ChatMessageRecord, ChatRoomRecord, ChatSnapshot } from '@/modules/Chat/types/chat.types';

const CHAT_STORAGE_KEY = 'memory-atlas-chat';
const DEFAULT_ROOM_ID = 'atlas-lounge';

function buildDefaultRoom(): ChatRoomRecord {
    return {
        id: DEFAULT_ROOM_ID,
        title: 'Atlas Lounge',
        description: 'A shared traveler chat for quick stories, reactions, and local testing.',
        createdAt: new Date('2026-05-21T08:00:00.000Z').toISOString(),
    };
}

function buildDefaultMessages(roomId: string): ChatMessageRecord[] {
    return [
        {
            id: 'chat-seed-1',
            roomId,
            authorUserId: null,
            authorDisplayName: 'Atlas Guide',
            content:
                'Welcome to Atlas Lounge. This local-first chat is shaped for future sockets and backend persistence. ✨',
            sentAt: new Date('2026-05-21T08:05:00.000Z').toISOString(),
        },
        {
            id: 'chat-seed-2',
            roomId,
            authorUserId: null,
            authorDisplayName: 'Atlas Guide',
            content: 'Drop a quick memory, question, or emoji to see how the thread feels in the UI. 🌍',
            sentAt: new Date('2026-05-21T08:07:00.000Z').toISOString(),
        },
    ];
}

function buildDefaultSnapshot(): ChatSnapshot {
    const room = buildDefaultRoom();

    return {
        rooms: [room],
        messages: buildDefaultMessages(room.id),
        activeRoomId: room.id,
        isWidgetOpen: false,
    };
}

function isChatRoomRecord(value: unknown): value is ChatRoomRecord {
    if (!value || typeof value !== 'object') return false;

    const candidate = value as Record<string, unknown>;
    return (
        typeof candidate.id === 'string' &&
        typeof candidate.title === 'string' &&
        typeof candidate.description === 'string' &&
        typeof candidate.createdAt === 'string'
    );
}

function isChatMessageRecord(value: unknown): value is ChatMessageRecord {
    if (!value || typeof value !== 'object') return false;

    const candidate = value as Record<string, unknown>;
    return (
        typeof candidate.id === 'string' &&
        typeof candidate.roomId === 'string' &&
        (typeof candidate.authorUserId === 'string' || candidate.authorUserId === null) &&
        typeof candidate.authorDisplayName === 'string' &&
        typeof candidate.content === 'string' &&
        typeof candidate.sentAt === 'string'
    );
}

export const chatLocalGateway = {
    load(): ChatSnapshot {
        if (typeof window === 'undefined') {
            return buildDefaultSnapshot();
        }

        const rawSnapshot = window.localStorage.getItem(CHAT_STORAGE_KEY);
        if (!rawSnapshot) {
            return buildDefaultSnapshot();
        }

        try {
            const parsedSnapshot = JSON.parse(rawSnapshot) as Partial<ChatSnapshot>;
            const rooms = Array.isArray(parsedSnapshot.rooms)
                ? parsedSnapshot.rooms.filter(isChatRoomRecord)
                : buildDefaultSnapshot().rooms;
            const messages = Array.isArray(parsedSnapshot.messages)
                ? parsedSnapshot.messages.filter(isChatMessageRecord)
                : buildDefaultSnapshot().messages;
            const activeRoomId =
                typeof parsedSnapshot.activeRoomId === 'string' &&
                rooms.some((room) => room.id === parsedSnapshot.activeRoomId)
                    ? parsedSnapshot.activeRoomId
                    : (rooms[0]?.id ?? DEFAULT_ROOM_ID);

            return {
                rooms: rooms.length > 0 ? rooms : buildDefaultSnapshot().rooms,
                messages,
                activeRoomId,
                isWidgetOpen: parsedSnapshot.isWidgetOpen === true,
            };
        } catch {
            return buildDefaultSnapshot();
        }
    },

    save(snapshot: ChatSnapshot): void {
        if (typeof window === 'undefined') return;
        window.localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(snapshot));
    },
};
