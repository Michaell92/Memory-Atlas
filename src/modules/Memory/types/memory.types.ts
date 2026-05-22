/**
 * A single travel memory. Memories are anchored to a country (always) and
 * optionally to a city within that country. They never store coordinates —
 * geographic data lives on the `City` and country records.
 */
export interface Memory {
    id: string;
    /** Owning user id. Used to separate local accounts. */
    ownerUserId: string;
    /** Personal name for the memory, e.g. "Krakow Adventure". */
    title: string;
    /** 1\u20135 stars, or 0 if unrated. */
    rating: number;
    /** Country identity key. Currently numeric from globe clicks or alpha-2 from user search. */
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
    | {
          kind: 'country';
          access: 'locked' | 'unlocked';
          countryCode: string;
          countryName: string;
          latitude?: number;
          longitude?: number;
      }
    | {
          kind: 'city';
          cityId: string;
          cityName: string;
          countryCode: string;
          countryName: string;
          latitude?: number;
          longitude?: number;
      };
