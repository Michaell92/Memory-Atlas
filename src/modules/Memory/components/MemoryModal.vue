<template>
    <Teleport to="body">
        <Transition name="memory-modal">
            <div
                v-if="isOpen && currentScope"
                class="memory-modal"
                role="dialog"
                aria-modal="true"
                :aria-label="modalAriaLabel"
                @click.self="close"
                @keydown.escape="close"
            >
                <div class="memory-modal__backdrop" aria-hidden="true" />

                <div class="memory-modal__panel" :class="panelClasses">
                    <header class="memory-modal__header">
                        <div class="memory-modal__breadcrumb">
                            <button
                                v-if="currentScope.kind === 'city'"
                                type="button"
                                class="memory-modal__breadcrumb-link"
                                @click="escalateToCountry"
                            >
                                ← {{ currentScope.countryName }}
                            </button>
                            <span v-else class="memory-modal__breadcrumb-static">
                                {{ currentScope.countryName }}
                            </span>
                        </div>

                        <h2 class="memory-modal__title">
                            <span v-if="currentScope.kind === 'city'" class="memory-modal__title-city">
                                {{ currentScope.cityName }}
                            </span>
                            <span v-else class="memory-modal__title-country">
                                {{ currentScope.countryName }}
                            </span>
                            <span class="memory-modal__title-badge">
                                {{ memoryCount }} {{ memoryCount === 1 ? 'memory' : 'memories' }}
                            </span>
                            <label
                                class="memory-modal__title-toggle"
                                :class="{ 'memory-modal__title-toggle--disabled': !canSetCurrentLocation }"
                            >
                                <input
                                    :checked="isCurrentLocationSelected"
                                    type="checkbox"
                                    :disabled="!canSetCurrentLocation"
                                    @change="toggleCurrentLocation"
                                />
                                <span class="memory-modal__title-toggle-track">
                                    <span class="memory-modal__title-toggle-thumb" />
                                </span>
                                <span class="memory-modal__title-toggle-copy">Set as current location</span>
                            </label>
                        </h2>

                        <button type="button" class="memory-modal__close" aria-label="Close memories" @click="close">
                            ✕
                        </button>
                    </header>

                    <div class="memory-modal__content">
                        <section v-if="isLockedCountryScope" class="memory-modal__unlock-banner">
                            <p class="memory-modal__unlock-eyebrow">Locked country</p>
                            <h3 class="memory-modal__unlock-title">
                                Add your first memory to unlock {{ currentScope.countryName }}
                            </h3>
                            <p class="memory-modal__unlock-copy">
                                This country is still hidden in your atlas. Your first memory here unlocks it instantly.
                            </p>
                        </section>

                        <section
                            v-if="currentScope.kind === 'country' && citiesInCountry.length > 0"
                            class="memory-modal__cities"
                        >
                            <h3 class="memory-modal__section-title">Cities visited</h3>
                            <div class="memory-modal__city-chips">
                                <button
                                    v-for="city in citiesInCountry"
                                    :key="city.cityId"
                                    type="button"
                                    class="memory-modal__city-chip"
                                    @click="drillDownToCity(city.cityId, city.cityName)"
                                >
                                    <span class="memory-modal__city-chip-name">{{ city.cityName }}</span>
                                    <span class="memory-modal__city-chip-count">{{ city.count }}</span>
                                </button>
                            </div>
                        </section>

                        <section class="memory-modal__memories">
                            <div class="memory-modal__memories-header">
                                <h3 class="memory-modal__section-title">Memories</h3>

                                <button
                                    v-if="!isComposerOpen"
                                    type="button"
                                    class="memory-modal__add"
                                    @click="openComposer"
                                >
                                    {{ isLockedCountryScope ? 'Unlock country' : 'New memory' }}
                                </button>
                            </div>

                            <form
                                v-if="isComposerOpen"
                                class="memory-modal__composer"
                                @submit.prevent="saveDraftMemory"
                            >
                                <label class="memory-modal__field memory-modal__field--wide">
                                    <span>Memory title</span>
                                    <input
                                        v-model="draftTitle"
                                        type="text"
                                        placeholder="Golden hour over the old city"
                                    />
                                </label>

                                <label v-if="currentScope.kind === 'city'" class="memory-modal__field">
                                    <span>City</span>
                                    <input :value="currentScope.cityName" type="text" disabled />
                                </label>

                                <label class="memory-modal__field">
                                    <span>Visited</span>
                                    <input v-model="draftVisitedAt" type="date" />
                                </label>

                                <label class="memory-modal__field">
                                    <span>Rating</span>
                                    <select v-model.number="draftRating">
                                        <option
                                            v-for="ratingOption in ratingOptions"
                                            :key="ratingOption"
                                            :value="ratingOption"
                                        >
                                            {{ ratingOption }} star{{ ratingOption === 1 ? '' : 's' }}
                                        </option>
                                    </select>
                                </label>

                                <label class="memory-modal__field memory-modal__field--wide">
                                    <span>Notes</span>
                                    <textarea
                                        v-model="draftNotes"
                                        rows="4"
                                        placeholder="What made this memory stick?"
                                    />
                                </label>

                                <p v-if="draftFeedbackMessage" class="memory-modal__feedback">
                                    {{ draftFeedbackMessage }}
                                </p>

                                <div class="memory-modal__composer-actions">
                                    <button type="button" class="memory-modal__secondary-action" @click="closeComposer">
                                        Cancel
                                    </button>
                                    <button type="submit" class="memory-modal__primary-action">
                                        {{ primaryActionLabel }}
                                    </button>
                                </div>
                            </form>

                            <div v-if="visibleMemories.length === 0" class="memory-modal__empty">
                                <p class="memory-modal__empty-title">
                                    {{ isLockedCountryScope ? 'This country is still locked' : 'No memories here yet' }}
                                </p>
                                <p class="memory-modal__empty-sub">
                                    {{
                                        isLockedCountryScope
                                            ? 'Save the first memory above to unlock it on the globe.'
                                            : 'Click "New memory" above to capture your first.'
                                    }}
                                </p>
                            </div>

                            <div v-else class="memory-modal__memory-list">
                                <MemoryCard
                                    v-for="memory in visibleMemories"
                                    :key="memory.id"
                                    :memory="memory"
                                    @update-title="onUpdateTitle"
                                    @update-notes="onUpdateNotes"
                                    @update-rating="onUpdateRating"
                                    @update-visited-at="onUpdateVisitedAt"
                                    @add-media="onAddMedia"
                                    @remove-media="onRemoveMedia"
                                    @delete="onDelete"
                                />
                            </div>
                        </section>
                    </div>
                </div>
            </div>
        </Transition>
    </Teleport>

    <ConfirmDialog
        :is-open="pendingDeleteMemoryId !== null"
        title="Delete this memory?"
        message="This action removes the memory and its local media from this traveler profile."
        @confirm="confirmDelete"
        @cancel="cancelDelete"
    />
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';

import { useCountryUnlockCelebration } from '@/modules/Globe/composables/useCountryUnlockCelebration';
import MemoryCard from '@/modules/Memory/components/MemoryCard.vue';
import { useMemoryModal } from '@/modules/Memory/composables/useMemoryModal';
import { useMemoryStore } from '@/modules/Memory/stores/memoryStore';
import { useUserStore } from '@/modules/User/stores/userStore';
import ConfirmDialog from '@/shared/components/ConfirmDialog.vue';

const memoryStore = useMemoryStore();
const userStore = useUserStore();
const { currentScope, isOpen, close, drillDownToCity, escalateToCountry } = useMemoryModal();
const { triggerCelebration } = useCountryUnlockCelebration();
const isComposerOpen = ref(false);
const draftTitle = ref('');
const draftVisitedAt = ref(new Date().toISOString().slice(0, 10));
const draftRating = ref(5);
const draftNotes = ref('');
const draftFeedbackMessage = ref('');
const pendingDeleteMemoryId = ref<string | null>(null);

const ratingOptions = [5, 4, 3, 2, 1];

const visibleMemories = computed(() => {
    const scope = currentScope.value;
    if (!scope) return [];
    if (scope.kind === 'city') {
        return memoryStore.memoriesByCityScope(scope.cityId, scope.cityName, scope.countryCode, scope.countryName);
    }
    return memoryStore.memoriesByCountry(scope.countryCode, scope.countryName);
});

const memoryCount = computed(() => visibleMemories.value.length);
const isLockedCountryScope = computed(
    () => currentScope.value?.kind === 'country' && currentScope.value.access === 'locked',
);
const panelClasses = computed(() => ({
    'memory-modal__panel--locked': isLockedCountryScope.value,
}));
const primaryActionLabel = computed(() => (isLockedCountryScope.value ? 'Save and unlock' : 'Save memory'));

const citiesInCountry = computed(() => {
    const scope = currentScope.value;
    if (!scope || scope.kind !== 'country') return [];
    return memoryStore.citiesWithMemoriesInCountry(scope.countryCode, scope.countryName);
});

const modalAriaLabel = computed(() => {
    const scope = currentScope.value;
    if (!scope) return 'Memories';
    return scope.kind === 'city'
        ? `Memories for ${scope.cityName}, ${scope.countryName}`
        : `Memories for ${scope.countryName}`;
});
const canSetCurrentLocation = computed(() => {
    const scope = currentScope.value;
    if (!scope) return false;
    if (scope.kind === 'country' && scope.access === 'locked') return false;
    return scope.latitude !== undefined && scope.longitude !== undefined;
});
const isCurrentLocationSelected = computed(() => {
    const scope = currentScope.value;
    const currentLocation = userStore.currentLocation;
    if (!scope || !currentLocation) return false;

    if (scope.kind === 'city') {
        return currentLocation.cityId === scope.cityId;
    }

    return (
        currentLocation.countryCode === scope.countryCode &&
        (!currentLocation.cityId || currentLocation.cityName === undefined)
    );
});

function resetComposer(): void {
    draftTitle.value = '';
    draftVisitedAt.value = new Date().toISOString().slice(0, 10);
    draftRating.value = 5;
    draftNotes.value = '';
    draftFeedbackMessage.value = '';
}

function closeComposer(): void {
    isComposerOpen.value = false;
    resetComposer();
}

function openComposer(): void {
    isComposerOpen.value = true;
}

function saveDraftMemory(): void {
    const scope = currentScope.value;
    if (!scope) return;
    const shouldUnlockCountry = scope.kind === 'country' && scope.access === 'locked' && memoryCount.value === 0;

    draftFeedbackMessage.value = '';

    if (draftTitle.value.trim().length < 2) {
        draftFeedbackMessage.value = 'Give the memory a title.';
        return;
    }

    memoryStore.addMemory({
        title: draftTitle.value.trim(),
        rating: draftRating.value,
        countryCode: scope.countryCode,
        countryName: scope.countryName,
        cityId: scope.kind === 'city' ? scope.cityId : undefined,
        cityName: scope.kind === 'city' ? scope.cityName : undefined,
        notes: draftNotes.value.trim(),
        media: [],
        visitedAt: draftVisitedAt.value,
    });

    if (shouldUnlockCountry) {
        currentScope.value = {
            ...scope,
            access: 'unlocked',
        };
        triggerCelebration(scope.countryCode, scope.countryName);
    }

    closeComposer();
}

function toggleCurrentLocation(event: Event): void {
    const target = event.target as HTMLInputElement;
    const scope = currentScope.value;
    if (!scope) return;
    if (scope.kind === 'country' && scope.access === 'locked') {
        target.checked = false;
        return;
    }

    if (!target.checked) {
        if (isCurrentLocationSelected.value) {
            userStore.clearCurrentLocation();
        }
        return;
    }

    if (scope.latitude === undefined || scope.longitude === undefined) return;

    userStore.setCurrentLocation({
        countryCode: scope.countryCode,
        countryName: scope.countryName,
        cityId: scope.kind === 'city' ? scope.cityId : undefined,
        cityName: scope.kind === 'city' ? scope.cityName : undefined,
        latitude: scope.latitude,
        longitude: scope.longitude,
    });
}

function onUpdateTitle(memoryId: string, title: string): void {
    memoryStore.updateMemory(memoryId, { title });
}
function onUpdateNotes(memoryId: string, notes: string): void {
    memoryStore.updateMemory(memoryId, { notes });
}
function onUpdateRating(memoryId: string, rating: number): void {
    memoryStore.updateMemory(memoryId, { rating });
}
function onUpdateVisitedAt(memoryId: string, visitedAt: string): void {
    memoryStore.updateMemory(memoryId, { visitedAt });
}
function onAddMedia(memoryId: string, mediaUrl: string): void {
    memoryStore.addMediaToMemory(memoryId, mediaUrl);
}
function onRemoveMedia(memoryId: string, mediaUrl: string): void {
    memoryStore.removeMediaFromMemory(memoryId, mediaUrl);
}
function onDelete(memoryId: string): void {
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

// Global escape-to-close — the modal must close even when focus is in a deep
// child (textarea, date input, etc.) where bubbling can be swallowed.
function onGlobalKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && isOpen.value) close();
}

onMounted(() => {
    window.addEventListener('keydown', onGlobalKeydown);
});
onUnmounted(() => {
    window.removeEventListener('keydown', onGlobalKeydown);
});

watch(currentScope, () => {
    closeComposer();
    cancelDelete();

    if (currentScope.value?.kind === 'country' && currentScope.value.access === 'locked') {
        isComposerOpen.value = true;
    }
});
</script>

<style lang="scss" scoped>
@use '@/styles/variables' as *;
@use '@/styles/mixins' as *;

.memory-modal {
    position: fixed;
    inset: 0;
    z-index: $z-modal;
    @include flex-center;
    contain: layout paint;

    &__backdrop {
        position: absolute;
        inset: 0;
        background: transparent;
    }

    &__panel {
        position: relative;
        width: min(56rem, calc(100vw - 2rem));
        max-height: calc(100vh - 2rem);
        display: flex;
        flex-direction: column;
        border-radius: $radius-lg;
        background: rgba($color-void, 0.96);
        border: 1px solid rgba($color-aurora, 0.2);
        box-shadow: 0 1rem 2rem rgba($color-void, 0.38);
        overflow: hidden;
        contain: layout paint;

        &--locked {
            border-color: rgba($color-memory, 0.34);
            background:
                radial-gradient(circle at top, rgba($color-memory, 0.18), transparent 34%), rgba($color-void, 0.98);
            box-shadow:
                0 1rem 2rem rgba($color-void, 0.42),
                0 0 2.25rem rgba($color-memory, 0.16);

            .memory-modal__header {
                border-bottom-color: rgba($color-memory, 0.18);
            }

            .memory-modal__title {
                @include text-glow($color-memory, 0.5rem);
            }

            .memory-modal__title-badge {
                background: rgba($color-memory, 0.12);
                color: $color-memory;
            }

            .memory-modal__composer {
                border-color: rgba($color-memory, 0.18);
                background: rgba($color-memory, 0.08);
            }

            .memory-modal__primary-action,
            .memory-modal__add {
                border-color: rgba($color-memory, 0.36);
                background: linear-gradient(135deg, rgba($color-memory, 0.24), rgba($color-aurora, 0.16));
                color: $color-text;
            }
        }
    }

    &__unlock-banner {
        padding: 1rem 1.125rem;
        border-radius: $radius-lg;
        border: 1px solid rgba($color-memory, 0.22);
        background:
            linear-gradient(135deg, rgba($color-memory, 0.14), rgba($color-aurora, 0.06)), rgba($color-void, 0.44);
    }

    &__unlock-eyebrow {
        margin: 0 0 0.375rem;
        font-size: $font-size-xs;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: $color-memory;
    }

    &__unlock-title {
        margin: 0;
        font-size: $font-size-lg;
        color: $color-text;
    }

    &__unlock-copy {
        margin: 0.375rem 0 0;
        font-size: $font-size-sm;
        color: $color-text-muted;
        line-height: 1.5;
    }

    &__header {
        display: grid;
        grid-template-columns: 1fr auto;
        grid-template-areas:
            'breadcrumb close'
            'title title';
        gap: 0.5rem 1rem;
        padding: 1.25rem 1.5rem 1rem;
        border-bottom: 1px solid rgba($color-aurora, 0.1);
    }

    &__breadcrumb {
        grid-area: breadcrumb;
        font-size: $font-size-xs;
        color: $color-text-muted;
        text-transform: uppercase;
        letter-spacing: 0.08em;
    }

    &__breadcrumb-link {
        background: transparent;
        border: 0;
        color: $color-aurora;
        font: inherit;
        text-transform: inherit;
        letter-spacing: inherit;
        cursor: pointer;
        padding: 0;
        transition: text-shadow $duration-fast $ease-cinematic;

        &:hover {
            @include text-glow($color-aurora, 0.4rem);
        }
    }

    &__title {
        grid-area: title;
        display: flex;
        align-items: baseline;
        flex-wrap: wrap;
        gap: 0.75rem;
        margin: 0;
        font-size: $font-size-xl;
        font-weight: 600;
        color: $color-text;
        @include text-glow($color-aurora, 0.4rem);
    }

    &__title-badge {
        font-size: $font-size-xs;
        font-weight: 500;
        color: $color-text-muted;
        padding: 0.125rem 0.625rem;
        border-radius: $radius-pill;
        background: rgba($color-aurora, 0.1);
        text-shadow: none;
        letter-spacing: 0.04em;
        text-transform: uppercase;
    }

    &__close {
        grid-area: close;
        width: 2rem;
        height: 2rem;
        border-radius: 50%;
        border: 1px solid rgba($color-aurora, 0.2);
        background: rgba($color-void, 0.5);
        color: $color-text;
        font-size: $font-size-sm;
        cursor: pointer;
        transition:
            background $duration-fast $ease-cinematic,
            border-color $duration-fast $ease-cinematic,
            transform $duration-fast $ease-cinematic;

        &:hover {
            background: rgba($color-aurora, 0.15);
            border-color: $color-aurora;
            transform: rotate(90deg);
        }
    }

    &__content {
        padding: 1.25rem 1.5rem 1.5rem;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
        content-visibility: auto;
    }

    &__section-title {
        margin: 0 0 0.625rem;
        font-size: $font-size-sm;
        font-weight: 500;
        color: $color-text-muted;
        text-transform: uppercase;
        letter-spacing: 0.08em;
    }

    &__city-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
    }

    &__city-chip {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.375rem 0.875rem;
        border-radius: $radius-pill;
        background: rgba($color-cosmic-dust, 0.5);
        border: 1px solid rgba($color-aurora, 0.2);
        color: $color-text;
        font: inherit;
        font-size: $font-size-sm;
        cursor: pointer;
        transition:
            transform $duration-fast $ease-cinematic,
            border-color $duration-fast $ease-cinematic,
            background $duration-fast $ease-cinematic;

        &:hover {
            transform: translateY(-0.0625rem);
            border-color: $color-aurora;
            background: rgba($color-aurora, 0.15);
        }
    }

    &__city-chip-count {
        background: rgba($color-aurora, 0.2);
        color: $color-aurora;
        padding: 0.0625rem 0.4375rem;
        border-radius: $radius-pill;
        font-size: $font-size-xs;
        font-weight: 600;
    }

    &__memories-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 1rem;
        margin-bottom: 1rem;
    }

    &__title-toggle {
        display: inline-flex;
        align-items: center;
        gap: 0.75rem;
        margin-left: auto;
        cursor: pointer;

        input {
            position: absolute;
            opacity: 0;
            pointer-events: none;
        }

        &--disabled {
            cursor: not-allowed;
            opacity: 0.6;
        }

        input:checked + .memory-modal__title-toggle-track {
            background: rgba($color-aurora, 0.3);
            border-color: rgba($color-aurora, 0.55);

            .memory-modal__title-toggle-thumb {
                transform: translateX(1.25rem);
                background: #ff6767;
                box-shadow: 0 0 0.875rem rgba(#ff6767, 0.7);
            }
        }
    }

    &__title-toggle-track {
        position: relative;
        width: 2.75rem;
        height: 1.5rem;
        flex: 0 0 auto;
        border-radius: $radius-pill;
        border: 1px solid rgba($color-aurora, 0.2);
        background: rgba($color-void, 0.6);
        transition:
            background $duration-fast $ease-cinematic,
            border-color $duration-fast $ease-cinematic;
    }

    &__title-toggle-thumb {
        position: absolute;
        top: 0.125rem;
        left: 0.125rem;
        width: 1rem;
        height: 1rem;
        border-radius: 50%;
        background: $color-text;
        transition:
            transform $duration-fast $ease-cinematic,
            background $duration-fast $ease-cinematic,
            box-shadow $duration-fast $ease-cinematic;
    }

    &__title-toggle-copy {
        font-size: $font-size-sm;
        color: $color-text;
    }

    &__add {
        background: linear-gradient(135deg, rgba($color-aurora, 0.2), rgba($color-atmosphere, 0.2));
        border: 1px solid rgba($color-aurora, 0.4);
        color: $color-aurora;
        padding: 0.375rem 0.875rem;
        border-radius: $radius-pill;
        font: inherit;
        font-size: $font-size-sm;
        font-weight: 500;
        cursor: pointer;
        transition:
            transform $duration-fast $ease-cinematic,
            box-shadow $duration-fast $ease-cinematic;

        &:hover {
            transform: translateY(-0.0625rem);
            box-shadow: 0 0 1rem rgba($color-aurora, 0.4);
        }
    }

    &__empty {
        text-align: center;
        padding: 2rem 1rem;
        border-radius: $radius-lg;
        background: rgba($color-void, 0.3);
        border: 1px dashed rgba($color-aurora, 0.2);
    }

    &__empty-title {
        margin: 0 0 0.25rem;
        font-size: $font-size-base;
        color: $color-text;
    }

    &__empty-sub {
        margin: 0;
        font-size: $font-size-sm;
        color: $color-text-muted;
    }

    &__composer {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 1rem;
        margin-bottom: 1rem;
        padding: 1rem;
        border-radius: $radius-lg;
        background: rgba($color-cosmic-dust, 0.22);
        border: 1px solid rgba($color-aurora, 0.12);
    }

    &__field {
        display: grid;
        gap: 0.5rem;

        span {
            font-size: $font-size-xs;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            color: $color-text-muted;
        }

        input,
        select,
        textarea {
            width: 100%;
            min-height: 3rem;
            padding: 0.75rem 0.875rem;
            border-radius: $radius-md;
            border: 1px solid rgba($color-aurora, 0.14);
            background: rgba($color-void, 0.45);
            color: $color-text;
            font: inherit;

            &:focus {
                outline: none;
                border-color: rgba($color-aurora, 0.4);
            }

            &:disabled {
                opacity: 0.7;
                cursor: not-allowed;
            }
        }

        textarea {
            min-height: 7rem;
            resize: vertical;
        }

        &--wide {
            grid-column: 1 / -1;
        }
    }

    &__feedback {
        grid-column: 1 / -1;
        margin: 0;
        padding: 0.75rem 0.875rem;
        border-radius: $radius-md;
        background: rgba(255, 90, 90, 0.12);
        color: #ffd3d3;
    }

    &__composer-actions {
        grid-column: 1 / -1;
        display: flex;
        justify-content: flex-end;
        gap: 0.75rem;
    }

    &__secondary-action,
    &__primary-action {
        min-height: 2.75rem;
        padding: 0 1rem;
        border-radius: $radius-pill;
        font: inherit;
        cursor: pointer;
    }

    &__secondary-action {
        border: 1px solid rgba($color-aurora, 0.2);
        background: rgba($color-void, 0.5);
        color: $color-text;
    }

    &__primary-action {
        border: 1px solid rgba($color-aurora, 0.35);
        background: linear-gradient(135deg, rgba($color-aurora, 0.24), rgba($color-atmosphere, 0.2));
        color: $color-text;
    }

    &__memory-list {
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }
}

.memory-modal-enter-active,
.memory-modal-leave-active {
    transition: opacity $duration-base $ease-cinematic;

    .memory-modal__panel {
        transition:
            transform $duration-base $ease-cinematic,
            opacity $duration-base $ease-cinematic;
    }
}

.memory-modal-enter-from,
.memory-modal-leave-to {
    opacity: 0;

    .memory-modal__panel {
        opacity: 0;
        transform: translateY(0.75rem) scale(0.985);
    }
}
</style>
