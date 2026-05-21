<template>
    <section class="user-profile-section">
        <header class="user-profile-section__hero">
            <div>
                <p class="user-profile-section__eyebrow">Profile</p>
                <h3 class="user-profile-section__title">{{ userStore.displayName }}'s memory vault</h3>
                <p class="user-profile-section__copy">
                    Curate the globe with places that matter, then keep refining each memory card as the story grows.
                </p>

                <div class="user-profile-section__location-ribbon">
                    <div class="user-profile-section__location-badge user-profile-section__location-badge--current">
                        <span>Current location</span>
                        <strong>{{ currentLocationLabel }}</strong>
                    </div>
                    <div class="user-profile-section__location-badge">
                        <span>Home base</span>
                        <strong>{{ homeCountryLabel }}</strong>
                    </div>
                </div>
            </div>

            <div class="user-profile-section__stats">
                <article class="user-profile-section__stat-card">
                    <strong>{{ memories.length }}</strong>
                    <span>Total memories</span>
                </article>
                <article class="user-profile-section__stat-card">
                    <strong>{{ uniqueCountriesCount }}</strong>
                    <span>Countries logged</span>
                </article>
                <article class="user-profile-section__stat-card">
                    <strong>{{ uniqueCitiesCount }}</strong>
                    <span>Cities captured</span>
                </article>
            </div>
        </header>

        <section class="user-profile-section__composer">
            <div class="user-profile-section__composer-header">
                <div>
                    <p class="user-profile-section__eyebrow">New Memory</p>
                    <h4 class="user-profile-section__composer-title">
                        Add a destination with searchable country and city picks.
                    </h4>
                </div>
                <button type="button" class="user-profile-section__toggle" @click="isComposerOpen = !isComposerOpen">
                    {{ isComposerOpen ? 'Hide form' : 'Create memory' }}
                </button>
            </div>

            <form v-if="isComposerOpen" class="user-profile-section__composer-form" @submit.prevent="createMemory">
                <label class="user-profile-section__field user-profile-section__field--wide">
                    <span>Memory title</span>
                    <input v-model="draftTitle" type="text" placeholder="Moonrise over Lisbon rooftops" />
                </label>

                <UserOptionSearch
                    label="Country"
                    placeholder="Search a country"
                    :options="countryOptions"
                    :selected-id="selectedCountryCode"
                    empty-label="No country matched your search."
                    @select="selectCountry"
                    @clear="clearCountry"
                />

                <UserOptionSearch
                    label="City"
                    placeholder="Search a city"
                    :options="cityOptions"
                    :selected-id="selectedCityId"
                    :disabled="selectedCountryCode.length === 0"
                    empty-label="Choose a country first, then search its cities."
                    @select="selectCity"
                    @clear="clearCity"
                />

                <label class="user-profile-section__field">
                    <span>Visited</span>
                    <input v-model="visitedAt" type="date" />
                </label>

                <label class="user-profile-section__field">
                    <span>Rating</span>
                    <select v-model.number="rating">
                        <option v-for="option in ratingOptions" :key="option" :value="option">
                            {{ option }} star{{ option === 1 ? '' : 's' }}
                        </option>
                    </select>
                </label>

                <label class="user-profile-section__field user-profile-section__field--wide">
                    <span>Notes</span>
                    <textarea v-model="notes" rows="4" placeholder="What made this stop unforgettable?" />
                </label>

                <p v-if="feedbackMessage" class="user-profile-section__feedback">{{ feedbackMessage }}</p>

                <button type="submit" class="user-profile-section__submit">Save memory</button>
            </form>
        </section>

        <section class="user-profile-section__collection">
            <div class="user-profile-section__collection-header">
                <div>
                    <p class="user-profile-section__eyebrow">Collection</p>
                    <h4 class="user-profile-section__collection-title">Live memory cards</h4>
                </div>

                <label class="user-profile-section__search-field">
                    <span>Search</span>
                    <input v-model="searchQuery" type="search" placeholder="Search titles, countries, cities, notes" />
                </label>
            </div>

            <p v-if="memories.length === 0" class="user-profile-section__empty">
                No memories yet. Create the first one above and it will immediately sync to your globe flow.
            </p>

            <p v-else-if="displayedMemories.length === 0" class="user-profile-section__empty">
                Nothing matches that search.
            </p>

            <div v-else class="user-profile-section__memory-grid">
                <MemoryCard
                    v-for="memory in displayedMemories"
                    :key="memory.id"
                    :memory="memory"
                    @update-title="updateTitle"
                    @update-notes="updateNotes"
                    @update-rating="updateRating"
                    @update-visited-at="updateVisitedAt"
                    @add-media="addMedia"
                    @remove-media="removeMedia"
                    @delete="memoryStore.removeMemory"
                />
            </div>
        </section>
    </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

import MemoryCard from '@/modules/Memory/components/MemoryCard.vue';
import { useMemoryStore } from '@/modules/Memory/stores/memoryStore';
import UserOptionSearch from '@/modules/User/components/UserOptionSearch.vue';
import { loadCitySearchOptionsByCountry, loadCountrySearchOptions } from '@/modules/User/services/userLocationCatalog';
import { useUserStore } from '@/modules/User/stores/userStore';
import type { UserSearchOption } from '@/modules/User/types/user.types';

const memoryStore = useMemoryStore();
const userStore = useUserStore();

const countryOptions = ref<UserSearchOption[]>([]);
const cityOptions = ref<UserSearchOption[]>([]);

const isComposerOpen = ref(false);
const draftTitle = ref('');
const selectedCountryCode = ref('');
const selectedCountryName = ref('');
const selectedCityId = ref('');
const selectedCityName = ref('');
const visitedAt = ref(new Date().toISOString().slice(0, 10));
const rating = ref(5);
const notes = ref('');
const feedbackMessage = ref('');
const searchQuery = ref('');

const ratingOptions = [5, 4, 3, 2, 1];

const memories = computed(() => memoryStore.memories);
const uniqueCountriesCount = computed(() => new Set(memories.value.map((memory) => memory.countryName)).size);
const uniqueCitiesCount = computed(() => new Set(memories.value.map((memory) => memory.cityName).filter(Boolean)).size);
const displayedMemories = computed(() => {
    const normalizedQuery = searchQuery.value.trim().toLocaleLowerCase();
    if (!normalizedQuery) return memories.value;

    return memories.value.filter((memory) => {
        const searchText = [memory.title, memory.countryName, memory.cityName, memory.notes]
            .filter(Boolean)
            .join(' ')
            .toLocaleLowerCase();

        return searchText.includes(normalizedQuery);
    });
});
const currentLocationLabel = computed(() => {
    const currentLocation = userStore.currentLocation;
    if (!currentLocation) return 'Not set yet';
    return currentLocation.cityName
        ? `${currentLocation.cityName}, ${currentLocation.countryName}`
        : currentLocation.countryName;
});
const homeCountryLabel = computed(() => {
    const settings = userStore.currentUser?.settings;
    if (!settings?.homeCountryName) return 'Not set yet';
    return settings.homeCityName ? `${settings.homeCityName}, ${settings.homeCountryName}` : settings.homeCountryName;
});

onMounted(async () => {
    countryOptions.value = await loadCountrySearchOptions();
});

function resetComposer(): void {
    draftTitle.value = '';
    selectedCountryCode.value = '';
    selectedCountryName.value = '';
    selectedCityId.value = '';
    selectedCityName.value = '';
    cityOptions.value = [];
    visitedAt.value = new Date().toISOString().slice(0, 10);
    rating.value = 5;
    notes.value = '';
    feedbackMessage.value = '';
}

async function selectCountry(option: UserSearchOption): Promise<void> {
    selectedCountryCode.value = option.id;
    selectedCountryName.value = option.label;
    selectedCityId.value = '';
    selectedCityName.value = '';
    cityOptions.value = await loadCitySearchOptionsByCountry(option.id);
}

function clearCountry(): void {
    selectedCountryCode.value = '';
    selectedCountryName.value = '';
    clearCity();
    cityOptions.value = [];
}

function selectCity(option: UserSearchOption): void {
    selectedCityId.value = option.id;
    selectedCityName.value = option.label;
}

function clearCity(): void {
    selectedCityId.value = '';
    selectedCityName.value = '';
}

function createMemory(): void {
    feedbackMessage.value = '';

    if (draftTitle.value.trim().length < 2) {
        feedbackMessage.value = 'Give the memory a title.';
        return;
    }
    if (!selectedCountryCode.value || !selectedCountryName.value) {
        feedbackMessage.value = 'Pick a country.';
        return;
    }
    if (!selectedCityId.value || !selectedCityName.value) {
        feedbackMessage.value = 'Pick a city.';
        return;
    }

    memoryStore.addMemory({
        title: draftTitle.value.trim(),
        rating: rating.value,
        countryCode: selectedCountryCode.value,
        countryName: selectedCountryName.value,
        cityId: selectedCityId.value,
        cityName: selectedCityName.value,
        notes: notes.value.trim(),
        media: [],
        visitedAt: visitedAt.value,
    });

    resetComposer();
    isComposerOpen.value = false;
}

function updateTitle(memoryId: string, title: string): void {
    memoryStore.updateMemory(memoryId, { title });
}

function updateNotes(memoryId: string, nextNotes: string): void {
    memoryStore.updateMemory(memoryId, { notes: nextNotes });
}

function updateRating(memoryId: string, nextRating: number): void {
    memoryStore.updateMemory(memoryId, { rating: nextRating });
}

function updateVisitedAt(memoryId: string, nextVisitedAt: string): void {
    memoryStore.updateMemory(memoryId, { visitedAt: nextVisitedAt });
}

function addMedia(memoryId: string, mediaUrl: string): void {
    memoryStore.addMediaToMemory(memoryId, mediaUrl);
}

function removeMedia(memoryId: string, mediaUrl: string): void {
    memoryStore.removeMediaFromMemory(memoryId, mediaUrl);
}
</script>

<style lang="scss" scoped>
.user-profile-section {
    display: grid;
    gap: 1.5rem;

    &__hero,
    &__composer,
    &__collection {
        padding: 1.25rem;
        border-radius: 1.5rem;
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.06);
    }

    &__hero {
        display: grid;
        gap: 1rem;
    }

    &__eyebrow {
        margin: 0 0 0.5rem;
        font-size: 0.75rem;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--theme-text-muted);
    }

    &__title,
    &__composer-title,
    &__collection-title {
        margin: 0;
        color: var(--theme-text);
    }

    &__copy {
        margin: 0.5rem 0 0;
        max-width: 40rem;
        color: var(--theme-text-muted);
        line-height: 1.65;
    }

    &__location-ribbon {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, max-content));
        gap: 0.75rem;
        margin-top: 1rem;
    }

    &__location-badge {
        display: grid;
        gap: 0.2rem;
        padding: 0.875rem 1rem;
        border-radius: 1rem;
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.08);

        span {
            font-size: 0.7rem;
            letter-spacing: 0.1em;
            text-transform: uppercase;
            color: var(--theme-text-muted);
        }

        strong {
            color: var(--theme-text);
        }

        &--current {
            border-color: color-mix(in srgb, #ff5a5a 24%, transparent);
            background: linear-gradient(135deg, rgba(255, 90, 90, 0.14), rgba(255, 255, 255, 0.04));
        }
    }

    &__stats {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 0.875rem;
    }

    &__stat-card {
        display: grid;
        gap: 0.25rem;
        padding: 1rem;
        border-radius: 1.125rem;
        background: color-mix(in srgb, var(--theme-accent-soft) 78%, rgba(255, 255, 255, 0.04));
        border: 1px solid color-mix(in srgb, var(--theme-accent) 18%, transparent);

        strong {
            font-size: 1.75rem;
            color: var(--theme-text);
        }

        span {
            color: var(--theme-text-muted);
        }
    }

    &__composer-header,
    &__collection-header {
        display: flex;
        justify-content: space-between;
        gap: 1rem;
        align-items: center;
        margin-bottom: 1rem;
    }

    &__toggle,
    &__submit {
        min-height: 3rem;
        padding: 0 1rem;
        border: 0;
        border-radius: 1rem;
        background: linear-gradient(135deg, var(--theme-accent), color-mix(in srgb, var(--theme-accent) 54%, white));
        color: #081119;
        font: inherit;
        font-weight: 700;
        cursor: pointer;
    }

    &__composer-form {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 1rem;
    }

    &__field {
        display: grid;
        gap: 0.5rem;

        span {
            font-size: 0.75rem;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            color: var(--theme-text-muted);
        }

        input,
        textarea,
        select {
            min-height: 3rem;
            padding: 0.75rem 0.875rem;
            border-radius: 1rem;
            border: 1px solid rgba(255, 255, 255, 0.08);
            background: rgba(255, 255, 255, 0.04);
            color: var(--theme-text);
            font: inherit;

            &:focus {
                outline: none;
                border-color: color-mix(in srgb, var(--theme-accent) 54%, transparent);
            }
        }

        textarea {
            min-height: 8rem;
            resize: vertical;
        }

        &--wide {
            grid-column: 1 / -1;
        }
    }

    &__feedback,
    &__empty {
        margin: 0;
        color: var(--theme-text-muted);
    }

    &__feedback {
        grid-column: 1 / -1;
        padding: 0.875rem 1rem;
        border-radius: 1rem;
        background: rgba(255, 171, 171, 0.08);
        color: #ffd3d3;
    }

    &__submit {
        justify-self: start;
    }

    &__search-field {
        display: grid;
        gap: 0.5rem;
        min-width: min(100%, 20rem);

        span {
            font-size: 0.75rem;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            color: var(--theme-text-muted);
        }

        input {
            min-height: 3rem;
            padding: 0.75rem 0.875rem;
            border-radius: 1rem;
            border: 1px solid rgba(255, 255, 255, 0.08);
            background: rgba(255, 255, 255, 0.04);
            color: var(--theme-text);
            font: inherit;

            &:focus {
                outline: none;
                border-color: color-mix(in srgb, var(--theme-accent) 54%, transparent);
            }
        }
    }

    &__memory-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 1rem;
    }
}

@media (max-width: 56rem) {
    .user-profile-section {
        &__stats,
        &__composer-form,
        &__memory-grid {
            grid-template-columns: 1fr;
        }

        &__composer-header,
        &__collection-header {
            flex-direction: column;
            align-items: flex-start;
        }

        &__location-ribbon {
            grid-template-columns: 1fr;
        }

        &__search-field {
            width: 100%;
        }
    }
}
</style>
