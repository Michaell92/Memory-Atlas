import type { Memory } from '@/modules/Memory/types/memory.types';

/**
 * Demo seed memories. Replaced once persistence is wired up.
 * Country codes are world-atlas numeric ISO ids.
 */
export const seedMemories: Array<Omit<Memory, 'ownerUserId'>> = [
    {
        id: 'mem-pl-001',
        title: 'Krakow Adventure',
        rating: 5,
        countryCode: '616',
        countryName: 'Poland',
        cityId: 'pl-krakow',
        cityName: 'Krakow',
        notes: 'Pierogi until midnight, sunrise over the Vistula, dragon den below the castle.',
        media: [],
        visitedAt: '2024-06-12',
        createdAt: '2024-06-20T08:00:00.000Z',
    },
    {
        id: 'mem-jp-001',
        title: 'Cherry Blossom Week',
        rating: 4,
        countryCode: '392',
        countryName: 'Japan',
        cityId: 'jp-kyoto',
        cityName: 'Kyoto',
        notes: 'Philosopher\u2019s Path at dawn — petals on every step.',
        media: [],
        visitedAt: '2023-04-02',
        createdAt: '2023-04-15T12:00:00.000Z',
    },
];
