import { loadCityCatalog } from '@/modules/Globe/services/CityCatalog';
import type { UserSearchOption } from '@/modules/User/types/user.types';
import type { City } from '@/shared/types/city.types';

const countryDisplayNames = typeof Intl !== 'undefined' ? new Intl.DisplayNames(['en'], { type: 'region' }) : null;

const cityCatalogPromise = loadCityCatalog('cities15000');
let countryOptionsPromise: Promise<UserSearchOption[]> | null = null;
let cityOptionsByCountryPromise: Promise<Map<string, UserSearchOption[]>> | null = null;

function resolveCountryName(countryCode: string): string {
    return countryDisplayNames?.of(countryCode.toUpperCase()) ?? countryCode.toUpperCase();
}

function formatPopulation(population: number | undefined): string {
    if (!population || population <= 0) return 'Memory-ready destination';
    return `${new Intl.NumberFormat('en-US').format(population)} residents`;
}

export async function loadCountrySearchOptions(): Promise<UserSearchOption[]> {
    if (countryOptionsPromise) return countryOptionsPromise;

    countryOptionsPromise = cityCatalogPromise.then((cities) => {
        const optionsByCountry = new Map<string, UserSearchOption>();

        for (const city of cities) {
            if (optionsByCountry.has(city.countryCode)) continue;
            optionsByCountry.set(city.countryCode, {
                id: city.countryCode,
                label: resolveCountryName(city.countryCode),
                description: city.countryCode.toUpperCase(),
            });
        }

        return Array.from(optionsByCountry.values()).sort((leftOption, rightOption) =>
            leftOption.label.localeCompare(rightOption.label),
        );
    });

    return countryOptionsPromise;
}

export async function loadCitySearchOptionsByCountry(countryCode: string): Promise<UserSearchOption[]> {
    if (!cityOptionsByCountryPromise) {
        cityOptionsByCountryPromise = cityCatalogPromise.then((cities) => buildCityOptionsByCountry(cities));
    }

    const cityOptionsByCountry = await cityOptionsByCountryPromise;
    return cityOptionsByCountry.get(countryCode) ?? [];
}

function buildCityOptionsByCountry(cities: City[]): Map<string, UserSearchOption[]> {
    const groupedOptions = new Map<string, UserSearchOption[]>();

    for (const city of cities) {
        const countryCities = groupedOptions.get(city.countryCode) ?? [];
        countryCities.push({
            id: city.id,
            label: city.name,
            description: formatPopulation(city.population),
        });
        groupedOptions.set(city.countryCode, countryCities);
    }

    for (const [countryCode, countryCities] of groupedOptions.entries()) {
        groupedOptions.set(
            countryCode,
            countryCities.sort((leftOption, rightOption) => leftOption.label.localeCompare(rightOption.label)),
        );
    }

    return groupedOptions;
}
