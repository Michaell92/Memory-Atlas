import { computed, ref } from 'vue';
import { defineStore } from 'pinia';

import { memoryLocalGateway } from '@/modules/Memory/services/memoryLocalGateway';
import type { Memory } from '@/modules/Memory/types/memory.types';
import { seedMemories } from '@/modules/Memory/utils/memorySeeds';
import { useUserStore } from '@/modules/User/stores/userStore';

function normalizeCityKey(value: string | undefined): string {
    return value?.trim().toLocaleLowerCase() ?? '';
}

function normalizeCountryKey(value: string | undefined): string {
    return value?.trim().toLocaleLowerCase() ?? '';
}

function generateMemoryId(): string {
    // Browser-native UUIDs where available, with a tiny fallback.
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return `mem-${crypto.randomUUID()}`;
    }
    return `mem-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export const useMemoryStore = defineStore('memory', () => {
    const userStore = useUserStore();
    const allMemories = ref<Memory[]>(memoryLocalGateway.load());

    const memories = computed(() => {
        if (!userStore.currentUserId) return [];
        return allMemories.value.filter((memory) => memory.ownerUserId === userStore.currentUserId);
    });

    function persistMemories(): void {
        memoryLocalGateway.save(allMemories.value);
    }

    function matchesCountry(memory: Memory, countryCode: string, countryName?: string): boolean {
        if (memory.countryCode === countryCode) return true;
        if (!countryName) return false;
        return normalizeCountryKey(memory.countryName) === normalizeCountryKey(countryName);
    }

    const memoriesByCountry = computed(
        () => (countryCode: string, countryName?: string) =>
            memories.value.filter((memory) => matchesCountry(memory, countryCode, countryName)),
    );

    const memoriesByCity = computed(
        () => (cityId: string) => memories.value.filter((memory) => memory.cityId === cityId),
    );

    const memoriesByCityScope = computed(
        () => (cityId: string, cityName: string, countryCode: string, countryName?: string) => {
            const normalizedCityName = normalizeCityKey(cityName);

            return memories.value.filter((memory) => {
                if (!matchesCountry(memory, countryCode, countryName)) return false;
                if (!memory.cityId && !memory.cityName) return false;
                if (memory.cityId === cityId) return true;
                return normalizeCityKey(memory.cityName) === normalizedCityName;
            });
        },
    );

    function resolveMemoryCity(
        cityId: string,
        cityName: string,
        countryCode: string,
        countryName?: string,
    ): { cityId: string; cityName: string } {
        const existingMemory = memoriesByCityScope.value(cityId, cityName, countryCode, countryName)[0];

        if (existingMemory?.cityId && existingMemory.cityName) {
            return {
                cityId: existingMemory.cityId,
                cityName: existingMemory.cityName,
            };
        }

        return { cityId, cityName };
    }

    function ensureMemoriesForUser(userId: string): void {
        const hasExistingMemories = allMemories.value.some((memory) => memory.ownerUserId === userId);
        if (hasExistingMemories) return;

        allMemories.value = [
            ...seedMemories.map((memorySeed) => ({
                ...memorySeed,
                id: generateMemoryId(),
                ownerUserId: userId,
            })),
            ...allMemories.value,
        ];
        persistMemories();
    }

    function addMemory(partial: Omit<Memory, 'id' | 'createdAt' | 'ownerUserId'>): Memory | null {
        if (!userStore.currentUserId) return null;

        const created: Memory = {
            ...partial,
            id: generateMemoryId(),
            ownerUserId: userStore.currentUserId,
            createdAt: new Date().toISOString(),
        };
        allMemories.value = [created, ...allMemories.value];
        persistMemories();
        return created;
    }

    function updateMemory(memoryId: string, patch: Partial<Memory>): void {
        const index = allMemories.value.findIndex(
            (memory) => memory.id === memoryId && memory.ownerUserId === userStore.currentUserId,
        );
        if (index === -1) return;
        const existing = allMemories.value[index];
        if (!existing) return;
        allMemories.value[index] = { ...existing, ...patch, id: existing.id, ownerUserId: existing.ownerUserId };
        persistMemories();
    }

    function removeMemory(memoryId: string): void {
        allMemories.value = allMemories.value.filter(
            (memory) => !(memory.id === memoryId && memory.ownerUserId === userStore.currentUserId),
        );
        persistMemories();
    }

    function addMediaToMemory(memoryId: string, mediaUrl: string): void {
        const memory = allMemories.value.find(
            (entry) => entry.id === memoryId && entry.ownerUserId === userStore.currentUserId,
        );
        if (!memory) return;
        memory.media = [...memory.media, mediaUrl];
        persistMemories();
    }

    function removeMediaFromMemory(memoryId: string, mediaUrl: string): void {
        const memory = allMemories.value.find(
            (entry) => entry.id === memoryId && entry.ownerUserId === userStore.currentUserId,
        );
        if (!memory) return;
        memory.media = memory.media.filter((url) => url !== mediaUrl);
        persistMemories();
    }

    /** Distinct cities that have at least one memory inside the given country. */
    const citiesWithMemoriesInCountry = computed(() => (countryCode: string, countryName?: string) => {
        const seen = new Map<string, { cityId: string; cityName: string; count: number }>();
        for (const memory of memories.value) {
            if (!matchesCountry(memory, countryCode, countryName)) continue;
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
        allMemories,
        memoriesByCountry,
        memoriesByCity,
        memoriesByCityScope,
        citiesWithMemoriesInCountry,
        resolveMemoryCity,
        ensureMemoriesForUser,
        addMemory,
        updateMemory,
        removeMemory,
        addMediaToMemory,
        removeMediaFromMemory,
    };
});
