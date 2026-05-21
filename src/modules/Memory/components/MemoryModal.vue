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

                <div class="memory-modal__panel">
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
                        </h2>

                        <button type="button" class="memory-modal__close" aria-label="Close memories" @click="close">
                            ✕
                        </button>
                    </header>

                    <div class="memory-modal__content">
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
                                <button type="button" class="memory-modal__add" @click="createBlankMemory">
                                    + New memory
                                </button>
                            </div>

                            <div v-if="visibleMemories.length === 0" class="memory-modal__empty">
                                <p class="memory-modal__empty-title">No memories here yet</p>
                                <p class="memory-modal__empty-sub">Click "New memory" above to capture your first.</p>
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
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue';

import MemoryCard from '@/modules/Memory/components/MemoryCard.vue';
import { useMemoryModal } from '@/modules/Memory/composables/useMemoryModal';
import { useMemoryStore } from '@/modules/Memory/stores/memoryStore';

const memoryStore = useMemoryStore();
const { currentScope, isOpen, close, drillDownToCity, escalateToCountry } = useMemoryModal();

const visibleMemories = computed(() => {
    const scope = currentScope.value;
    if (!scope) return [];
    if (scope.kind === 'city') {
        return memoryStore.memoriesByCityScope(scope.cityId, scope.cityName, scope.countryCode, scope.countryName);
    }
    return memoryStore.memoriesByCountry(scope.countryCode, scope.countryName);
});

const memoryCount = computed(() => visibleMemories.value.length);

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

function createBlankMemory(): void {
    const scope = currentScope.value;
    if (!scope) return;
    const today = new Date().toISOString().slice(0, 10);
    memoryStore.addMemory({
        title: '',
        rating: 0,
        countryCode: scope.countryCode,
        countryName: scope.countryName,
        cityId: scope.kind === 'city' ? scope.cityId : undefined,
        cityName: scope.kind === 'city' ? scope.cityName : undefined,
        notes: '',
        media: [],
        visitedAt: today,
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
    memoryStore.removeMemory(memoryId);
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
        align-items: center;
        margin-bottom: 1rem;
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
