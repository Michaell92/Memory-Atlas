/**
 * A single travel memory. Memories are anchored to a country (always) and
 * optionally to a city within that country. They never store coordinates —
 * geographic data lives on the `City` and country records.
 */
export interface Memory {
    id: string;
    /** Personal name for the memory, e.g. "Krakow Adventure". */
    title: string;
    /** 1\u20135 stars, or 0 if unrated. */
    rating: number;
    /** ISO 3166-1 numeric country code (matches world-atlas topology ids). */
    countryCode: string;
    /** Display name of the country at the time the memory was created. */
    countryName: string;
    /** Optional city anchor. When absent, the memory is country-scoped. */
    cityId?: string;
    /** Optional city display name (denormalized for quick rendering). */
    cityName?: string;
    /** Free-form notes the user writes about the memory. */
    notes: string;
    /** Media URLs (object URLs or data URLs for local uploads). */
    media: string[];
    /** When the trip happened (ISO date string). */
    visitedAt: string;
    /** When the memory record was created (ISO date string). */
    createdAt: string;
}

/** Scope passed to the Memory modal when it opens. */
export type MemoryScope =
    | { kind: 'country'; countryCode: string; countryName: string }
    | { kind: 'city'; cityId: string; cityName: string; countryCode: string; countryName: string };
