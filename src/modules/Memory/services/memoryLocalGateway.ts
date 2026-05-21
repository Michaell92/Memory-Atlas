import type { Memory } from '@/modules/Memory/types/memory.types';

export interface MemoryGateway {
    load: () => Memory[];
    save: (memories: Memory[]) => void;
}

const STORAGE_KEY = 'memory-atlas.memories.v1';

function isBrowserEnvironment(): boolean {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export const memoryLocalGateway: MemoryGateway = {
    load(): Memory[] {
        if (!isBrowserEnvironment()) return [];

        const rawValue = window.localStorage.getItem(STORAGE_KEY);
        if (!rawValue) return [];

        try {
            const parsed = JSON.parse(rawValue) as unknown;
            return Array.isArray(parsed) ? (parsed as Memory[]) : [];
        } catch {
            return [];
        }
    },

    save(memories: Memory[]): void {
        if (!isBrowserEnvironment()) return;
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(memories));
    },
};
