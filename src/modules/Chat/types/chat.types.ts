export interface ChatRoomRecord {
    id: string;
    title: string;
    description: string;
    createdAt: string;
}

export interface ChatMessageRecord {
    id: string;
    roomId: string;
    authorUserId: string | null;
    authorDisplayName: string;
    content: string;
    sentAt: string;
}

export interface ChatSnapshot {
    rooms: ChatRoomRecord[];
    messages: ChatMessageRecord[];
    activeRoomId: string;
    isWidgetOpen: boolean;
}

export interface SendChatMessagePayload {
    roomId?: string;
    authorUserId: string | null;
    authorDisplayName: string;
    content: string;
}
