<template>
    <section class="user-settings-section">
        <header class="user-settings-section__hero">
            <div>
                <p class="user-settings-section__eyebrow">Settings</p>
                <h3 class="user-settings-section__title">Tune the atlas to the traveler.</h3>
            </div>
        </header>

        <section class="user-settings-section__block">
            <div class="user-settings-section__block-header">
                <div>
                    <p class="user-settings-section__eyebrow">Theme</p>
                    <h4 class="user-settings-section__block-title">Choose a planet mood.</h4>
                </div>
                <p class="user-settings-section__hint">
                    Themes recolor the globe, the space backdrop, and the user surfaces.
                </p>
            </div>

            <div class="user-settings-section__theme-grid">
                <button
                    v-for="themePalette in userStore.availableThemes"
                    :key="themePalette.id"
                    type="button"
                    class="user-settings-section__theme-card"
                    :class="{ 'user-settings-section__theme-card--active': themePalette.id === activeThemeId }"
                    @click="userStore.updateCurrentUserSettings({ themeId: themePalette.id })"
                >
                    <div class="user-settings-section__swatches">
                        <span :style="{ background: themePalette.ui.backgroundStart }" />
                        <span :style="{ background: themePalette.ui.accent }" />
                        <span :style="{ background: themePalette.globe.globeEmissive }" />
                    </div>
                    <strong>{{ themePalette.name }}</strong>
                    <span>{{ themePalette.tagline }}</span>
                </button>
            </div>
        </section>

        <section class="user-settings-section__block user-settings-section__block--form">
            <label class="user-settings-section__field user-settings-section__field--wide">
                <span>Brightness</span>
                <div class="user-settings-section__slider-row">
                    <input
                        :value="brightness"
                        type="range"
                        min="0.55"
                        max="1.55"
                        step="0.05"
                        @input="updateBrightness"
                    />
                    <strong>{{ brightness.toFixed(2) }}x</strong>
                </div>
            </label>

            <label class="user-settings-section__field">
                <span>Nickname</span>
                <input :value="nickname" type="text" placeholder="Star Sailor" @input="updateNickname" />
            </label>

            <label class="user-settings-section__field">
                <span>Year of birth</span>
                <input :value="yearOfBirth" type="date" @input="updateYearOfBirth" />
            </label>

            <section class="user-settings-section__location-card">
                <p class="user-settings-section__eyebrow">Home</p>

                <div class="user-settings-section__location-fields">
                    <UserOptionSearch
                        label="Country"
                        placeholder="Search your home country"
                        :options="countryOptions"
                        :selected-id="homeCountryCode"
                        empty-label="No country matched your search."
                        @select="selectHomeCountry"
                        @clear="clearHomeCountry"
                    />

                    <UserOptionSearch
                        label="City"
                        placeholder="Search your home city"
                        :options="homeCityOptions"
                        :selected-id="homeCityId"
                        :disabled="homeCountryCode.length === 0"
                        empty-label="Choose a home country first, then search its cities."
                        @select="selectHomeCity"
                        @clear="clearHomeCity"
                    />
                </div>
            </section>

            <section class="user-settings-section__location-card">
                <p class="user-settings-section__eyebrow">Current location</p>

                <div class="user-settings-section__location-fields">
                    <UserOptionSearch
                        label="Country"
                        placeholder="Search your current country"
                        :options="countryOptions"
                        :selected-id="currentLocationCountryCode"
                        empty-label="No country matched your search."
                        @select="selectCurrentLocationCountry"
                        @clear="clearCurrentLocationCountry"
                    />

                    <UserOptionSearch
                        label="City"
                        placeholder="Search your current city"
                        :options="currentLocationCityOptions"
                        :selected-id="currentLocationCityId"
                        :disabled="currentLocationCountryCode.length === 0"
                        empty-label="Choose a current country first, then search its cities."
                        @select="selectCurrentLocationCity"
                        @clear="clearCurrentLocationCity"
                    />
                </div>
            </section>
        </section>
    </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

import UserOptionSearch from '@/modules/User/components/UserOptionSearch.vue';
import { loadCitySearchOptionsByCountry, loadCountrySearchOptions } from '@/modules/User/services/userLocationCatalog';
import { useUserStore } from '@/modules/User/stores/userStore';
import type { UserSearchOption } from '@/modules/User/types/user.types';

const userStore = useUserStore();
const countryOptions = ref<UserSearchOption[]>([]);
const homeCityOptions = ref<UserSearchOption[]>([]);
const currentLocationCityOptions = ref<UserSearchOption[]>([]);

const activeThemeId = computed(() => userStore.currentUser?.settings.themeId ?? '');
const brightness = computed(() => userStore.currentBrightness);
const nickname = computed(() => userStore.currentUser?.settings.nickname ?? '');
const yearOfBirth = computed(() => userStore.currentUser?.settings.yearOfBirth ?? '');
const homeCountryCode = computed(() => userStore.currentUser?.settings.homeCountryCode ?? '');
const homeCityId = computed(() => userStore.currentUser?.settings.homeCityId ?? '');
const currentLocationCountryCode = computed(() => userStore.currentUser?.settings.currentLocationCountryCode ?? '');
const currentLocationCountryName = computed(() => userStore.currentUser?.settings.currentLocationCountryName ?? '');
const currentLocationCityId = computed(() => userStore.currentUser?.settings.currentLocationCityId ?? '');

onMounted(async () => {
    countryOptions.value = await loadCountrySearchOptions();

    if (homeCountryCode.value) {
        homeCityOptions.value = await loadCitySearchOptionsByCountry(homeCountryCode.value);
    }

    if (currentLocationCountryCode.value) {
        currentLocationCityOptions.value = await loadCitySearchOptionsByCountry(currentLocationCountryCode.value);
    }
});

function updateBrightness(event: Event): void {
    const target = event.target as HTMLInputElement;
    userStore.updateCurrentUserSettings({ brightness: Number(target.value) });
}

function updateNickname(event: Event): void {
    const target = event.target as HTMLInputElement;
    userStore.updateCurrentUserSettings({ nickname: target.value });
}

function updateYearOfBirth(event: Event): void {
    const target = event.target as HTMLInputElement;
    userStore.updateCurrentUserSettings({ yearOfBirth: target.value });
}

async function selectHomeCountry(option: UserSearchOption): Promise<void> {
    homeCityOptions.value = await loadCitySearchOptionsByCountry(option.id);
    userStore.updateCurrentUserSettings({
        homeCountryCode: option.id,
        homeCountryName: option.label,
        homeCityId: '',
        homeCityName: '',
    });
}

function clearHomeCountry(): void {
    homeCityOptions.value = [];
    userStore.updateCurrentUserSettings({
        homeCountryCode: '',
        homeCountryName: '',
        homeCityId: '',
        homeCityName: '',
    });
}

function selectHomeCity(option: UserSearchOption): void {
    userStore.updateCurrentUserSettings({
        homeCityId: option.id,
        homeCityName: option.label,
    });
}

function clearHomeCity(): void {
    userStore.updateCurrentUserSettings({
        homeCityId: '',
        homeCityName: '',
    });
}

async function selectCurrentLocationCountry(option: UserSearchOption): Promise<void> {
    currentLocationCityOptions.value = await loadCitySearchOptionsByCountry(option.id);

    if (option.latitude !== undefined && option.longitude !== undefined) {
        userStore.setCurrentLocation({
            countryCode: option.id,
            countryName: option.label,
            latitude: option.latitude,
            longitude: option.longitude,
        });
        return;
    }

    userStore.updateCurrentUserSettings({
        currentLocationCountryCode: option.id,
        currentLocationCountryName: option.label,
        currentLocationCityId: '',
        currentLocationCityName: '',
    });
}

function clearCurrentLocationCountry(): void {
    currentLocationCityOptions.value = [];
    userStore.clearCurrentLocation();
}

function selectCurrentLocationCity(option: UserSearchOption): void {
    if (!currentLocationCountryCode.value || option.latitude === undefined || option.longitude === undefined) {
        return;
    }

    userStore.setCurrentLocation({
        countryCode: currentLocationCountryCode.value,
        countryName: option.countryName ?? currentLocationCountryName.value,
        cityId: option.id,
        cityName: option.label,
        latitude: option.latitude,
        longitude: option.longitude,
    });
}

function clearCurrentLocationCity(): void {
    userStore.updateCurrentUserSettings({
        currentLocationCityId: '',
        currentLocationCityName: '',
        currentLocationLatitude: null,
        currentLocationLongitude: null,
    });
}
</script>

<style lang="scss" scoped>
.user-settings-section {
    display: grid;
    gap: 1.5rem;

    &__hero,
    &__block {
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

    &__title,
    &__block-title {
        margin: 0;
        color: var(--theme-text);
    }

    &__hint {
        margin: 0.5rem 0 0;
        color: var(--theme-text-muted);
        line-height: 1.65;
    }

    &__block-header {
        display: flex;
        justify-content: space-between;
        gap: 1rem;
        align-items: flex-start;
        margin-bottom: 1rem;
    }

    &__theme-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 1rem;
    }

    &__theme-card {
        display: grid;
        gap: 0.75rem;
        padding: 1rem;
        border-radius: 1.25rem;
        border: 1px solid rgba(255, 255, 255, 0.08);
        background: rgba(255, 255, 255, 0.03);
        color: var(--theme-text);
        text-align: left;
        cursor: pointer;
        transition:
            transform 180ms ease,
            border-color 180ms ease,
            background 180ms ease;

        span {
            color: var(--theme-text-muted);
        }

        &:hover,
        &--active {
            transform: translateY(-0.125rem);
            border-color: color-mix(in srgb, var(--theme-accent) 32%, transparent);
            background: color-mix(in srgb, var(--theme-accent-soft) 86%, rgba(255, 255, 255, 0.03));
        }
    }

    &__swatches {
        display: flex;
        gap: 0.5rem;

        span {
            width: 100%;
            height: 0.5rem;
            border-radius: 999rem;
        }
    }

    &__block--form {
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

        input {
            min-height: 3rem;
            padding: 0 0.875rem;
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

        &--wide {
            grid-column: 1 / -1;
        }
    }

    &__slider-row {
        display: flex;
        gap: 1rem;
        align-items: center;

        input {
            flex: 1;
            padding: 0;
        }

        strong {
            color: var(--theme-text);
        }
    }

    &__location-card {
        display: grid;
        gap: 1rem;
        padding: 1rem;
        border-radius: 1.25rem;
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.08);
    }

    &__location-fields {
        display: grid;
        gap: 1rem;
    }
}

@media (max-width: 56rem) {
    .user-settings-section {
        &__theme-grid,
        &__block--form {
            grid-template-columns: 1fr;
        }

        &__block-header {
            flex-direction: column;
        }
    }
}
</style>
