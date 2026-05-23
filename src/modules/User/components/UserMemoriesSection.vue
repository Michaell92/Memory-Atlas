<template>
    <section class="user-memories-section">
        <section class="user-memories-section__composer">
            <div class="user-memories-section__composer-header">
                <div>
                    <p class="user-memories-section__eyebrow">New Memory</p>
                    <h4 class="user-memories-section__composer-title">
                        Add a destination with searchable country and city picks.
                    </h4>
                </div>
                <button type="button" class="user-memories-section__toggle" @click="isComposerOpen = !isComposerOpen">
                    {{ isComposerOpen ? 'Hide form' : 'Create memory' }}
                </button>
            </div>

            <form v-if="isComposerOpen" class="user-memories-section__composer-form" @submit.prevent="createMemory">
                <label class="user-memories-section__field user-memories-section__field--wide">
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

                <label class="user-memories-section__field">
                    <span>Visited</span>
                    <input v-model="visitedAt" type="date" />
                </label>

                <label class="user-memories-section__field">
                    <span>Rating</span>
                    <select v-model.number="rating">
                        <option v-for="option in ratingOptions" :key="option" :value="option">
                            {{ option }} star{{ option === 1 ? '' : 's' }}
                        </option>
                    </select>
                </label>

                <label class="user-memories-section__field user-memories-section__field--wide">
                    <span>Notes</span>
                    <textarea v-model="notes" rows="4" placeholder="What made this stop unforgettable?" />
                </label>

                <p v-if="feedbackMessage" class="user-memories-section__feedback">{{ feedbackMessage }}</p>

                <button type="submit" class="user-memories-section__submit">Save memory</button>
            </form>
        </section>

        <section class="user-memories-section__collection">
            <div class="user-memories-section__collection-header">
                <div>
                    <p class="user-memories-section__eyebrow">Collection</p>
                    <h4 class="user-memories-section__collection-title">Live memory cards</h4>
                </div>

                <label class="user-memories-section__search-field">
                    <span>Search</span>
                    <input v-model="searchQuery" type="search" placeholder="Search titles, countries, cities, notes" />
                </label>
            </div>

            <p v-if="memories.length === 0" class="user-memories-section__empty">
                No memories yet. Create the first one above and it will immediately sync to your globe flow.
            </p>

            <p v-else-if="displayedMemories.length === 0" class="user-memories-section__empty">
                Nothing matches that search.
            </p>

            <div v-else class="user-memories-section__memory-grid">
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
                    @delete="requestDelete"
                />
            </div>
        </section>

        <ConfirmDialog
            :is-open="pendingDeleteMemoryId !== null"
            title="Delete this memory?"
            message="This action removes the memory and its local media from your profile."
            @confirm="confirmDelete"
            @cancel="cancelDelete"
        />
    </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

import MemoryCard from '@/modules/Memory/components/MemoryCard.vue';
import { useMemoryStore } from '@/modules/Memory/stores/memoryStore';
import UserOptionSearch from '@/modules/User/components/UserOptionSearch.vue';
import { loadCitySearchOptionsByCountry, loadCountrySearchOptions } from '@/modules/User/services/userLocationCatalog';
import ConfirmDialog from '@/shared/components/ConfirmDialog.vue';
import type { UserSearchOption } from '@/modules/User/types/user.types';

const memoryStore = useMemoryStore();

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
const pendingDeleteMemoryId = ref<string | null>(null);

const ratingOptions = [5, 4, 3, 2, 1];

const memories = computed(() => memoryStore.memories);
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

function requestDelete(memoryId: string): void {
    pendingDeleteMemoryId.value = memoryId;
}

function cancelDelete(): void {
    pendingDeleteMemoryId.value = null;
}

function confirmDelete(): void {
    if (!pendingDeleteMemoryId.value) return;
    memoryStore.removeMemory(pendingDeleteMemoryId.value);
    pendingDeleteMemoryId.value = null;
}
</script>

<style lang="scss" scoped>
.user-memories-section {
    display: grid;
    gap: 1.5rem;

    &__composer,
    &__collection {
        padding: 1.25rem;
        border-radius: 1.5rem;
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.06);
    }

    &__eyebrow {
        margin: 0 0 0.5rem;
        font-size: 0.75rem;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--theme-text-muted);
    }

    &__composer-title,
    &__collection-title {
        margin: 0;
        color: var(--theme-text);
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
    .user-memories-section {
        &__composer-form,
        &__memory-grid {
            grid-template-columns: 1fr;
        }

        &__composer-header,
        &__collection-header {
            flex-direction: column;
            align-items: flex-start;
        }

        &__search-field {
            width: 100%;
        }
    }
}
</style>
