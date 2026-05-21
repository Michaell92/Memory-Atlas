/**
 * A city is a geographic anchor on the globe. Cities are the single source of
 * truth for coordinates and country attribution; memories reference cities by
 * `id` and never store coordinates of their own.
 */
export interface City {
    id: string;
    name: string;
    /** ISO 3166-1 alpha-2 country code as returned by GeoNames (e.g. "FR", "PL"). */
    countryCode: string;
    countryName: string;
    lat: number;
    lng: number;
}
