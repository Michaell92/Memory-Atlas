import { computed, ref } from 'vue';
import { defineStore } from 'pinia';

import type { Memory } from '@/modules/Memory/types/memory.types';
import { seedMemories } from '@/modules/Memory/utils/memorySeeds';

function generateMemoryId(): string {
    // Browser-native UUIDs where available, with a tiny fallback.
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return `mem-${crypto.randomUUID()}`;
    }
    return `mem-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export const useMemoryStore = defineStore('memory', () => {
    const memories = ref<Memory[]>([...seedMemories]);

    const memoriesByCountry = computed(
        () => (countryCode: string) => memories.value.filter((memory) => memory.countryCode === countryCode),
    );

    const memoriesByCity = computed(
        () => (cityId: string) => memories.value.filter((memory) => memory.cityId === cityId),
    );

    function addMemory(partial: Omit<Memory, 'id' | 'createdAt'>): Memory {
        const created: Memory = {
            ...partial,
            id: generateMemoryId(),
            createdAt: new Date().toISOString(),
        };
        memories.value.unshift(created);
        return created;
    }

    function updateMemory(memoryId: string, patch: Partial<Memory>): void {
        const index = memories.value.findIndex((memory) => memory.id === memoryId);
        if (index === -1) return;
        const existing = memories.value[index];
        if (!existing) return;
        memories.value[index] = { ...existing, ...patch, id: existing.id };
    }

    function removeMemory(memoryId: string): void {
        memories.value = memories.value.filter((memory) => memory.id !== memoryId);
    }

    function addMediaToMemory(memoryId: string, mediaUrl: string): void {
        const memory = memories.value.find((entry) => entry.id === memoryId);
        if (!memory) return;
        memory.media = [...memory.media, mediaUrl];
    }

    function removeMediaFromMemory(memoryId: string, mediaUrl: string): void {
        const memory = memories.value.find((entry) => entry.id === memoryId);
        if (!memory) return;
        memory.media = memory.media.filter((url) => url !== mediaUrl);
    }

    /** Distinct cities that have at least one memory inside the given country. */
    const citiesWithMemoriesInCountry = computed(() => (countryCode: string) => {
        const seen = new Map<string, { cityId: string; cityName: string; count: number }>();
        for (const memory of memories.value) {
            if (memory.countryCode !== countryCode) continue;
            if (!memory.cityId || !memory.cityName) continue;
            const existing = seen.get(memory.cityId);
            if (existing) {
                existing.count += 1;
            } else {
                seen.set(memory.cityId, {
                    cityId: memory.cityId,
                    cityName: memory.cityName,
                    count: 1,
                });
            }
        }
        return Array.from(seen.values()).sort((a, b) => a.cityName.localeCompare(b.cityName));
    });

    return {
        memories,
        memoriesByCountry,
        memoriesByCity,
        citiesWithMemoriesInCountry,
        addMemory,
        updateMemory,
        removeMemory,
        addMediaToMemory,
        removeMediaFromMemory,
    };
});
