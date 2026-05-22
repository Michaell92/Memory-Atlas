import { computed, ref } from 'vue';

import { loadCityCatalog } from '@/modules/Globe/services/CityCatalog';
import { useMemoryStore } from '@/modules/Memory/stores/memoryStore';
import type { MemoryScope } from '@/modules/Memory/types/memory.types';

/**
 * Module-singleton state for the Memory modal.
 *
 * The modal is conceptually global (one at a time, opens from anywhere), so we
 * keep state at the module scope instead of inside `setup()`. Any component
 * can call `useMemoryModal()` to open or close it.
 */
const currentScope = ref<MemoryScope | null>(null);
const isOpen = computed(() => currentScope.value !== null);

function openAtCountry(
    countryCode: string,
    countryName: string,
    latitude?: number,
    longitude?: number,
    access: 'locked' | 'unlocked' = 'unlocked',
): void {
    currentScope.value = { kind: 'country', access, countryCode, countryName, latitude, longitude };
}

function openAtCity(
    cityId: string,
    cityName: string,
    countryCode: string,
    countryName: string,
    latitude?: number,
    longitude?: number,
): void {
    const memoryStore = useMemoryStore();
    const resolvedCity = memoryStore.resolveMemoryCity(cityId, cityName, countryCode, countryName);

    currentScope.value = {
        kind: 'city',
        cityId: resolvedCity.cityId,
        cityName: resolvedCity.cityName,
        countryCode,
        countryName,
        latitude,
        longitude,
    };
}

function close(): void {
    currentScope.value = null;
}

if (import.meta.hot) {
    import.meta.hot.dispose(() => {
        currentScope.value = null;
    });
}

/** Drill from country down into a specific city while modal stays open. */
async function drillDownToCity(cityId: string, cityName: string): Promise<void> {
    const scope = currentScope.value;
    if (!scope) return;

    const cityCatalog = await loadCityCatalog('cities15000');
    const matchedCity = cityCatalog.find((city) => city.id === cityId) ?? null;

    currentScope.value = {
        kind: 'city',
        cityId,
        cityName,
        countryCode: scope.countryCode,
        countryName: scope.countryName,
        latitude: matchedCity?.lat,
        longitude: matchedCity?.lng,
    };
}

/** Escalate from city up to its country while modal stays open. */
function escalateToCountry(): void {
    const scope = currentScope.value;
    if (!scope || scope.kind === 'country') return;
    currentScope.value = {
        kind: 'country',
        access: 'unlocked',
        countryCode: scope.countryCode,
        countryName: scope.countryName,
        latitude: scope.latitude,
        longitude: scope.longitude,
    };
}

export function useMemoryModal() {
    return {
        currentScope,
        isOpen,
        openAtCountry,
        openAtCity,
        close,
        drillDownToCity,
        escalateToCountry,
    };
}
