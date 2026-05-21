<template>
    <article class="memory-card">
        <header class="memory-card__header">
            <div class="memory-card__title-row">
                <input
                    v-if="isEditingTitle"
                    ref="titleInputRef"
                    v-model="draftTitle"
                    class="memory-card__title-input"
                    type="text"
                    placeholder="Memory title"
                    @blur="commitTitle"
                    @keydown.enter="commitTitle"
                    @keydown.escape="cancelTitle"
                />
                <h3
                    v-else
                    class="memory-card__title"
                    tabindex="0"
                    @click="startEditingTitle"
                    @keydown.enter="startEditingTitle"
                >
                    {{ memory.title || 'Untitled memory' }}
                    <span class="memory-card__edit-hint" aria-hidden="true">✎</span>
                </h3>

                <button
                    type="button"
                    class="memory-card__delete"
                    aria-label="Delete memory"
                    @click="$emit('delete', memory.id)"
                >
                    ✕
                </button>
            </div>

            <div class="memory-card__meta">
                <StarRating :model-value="memory.rating" @update:model-value="handleRatingChange" />
                <label class="memory-card__date">
                    <span class="memory-card__date-label">Visited</span>
                    <input
                        type="date"
                        class="memory-card__date-input"
                        :value="memory.visitedAt"
                        @change="handleDateChange"
                    />
                </label>
                <span v-if="memory.cityName" class="memory-card__chip">
                    {{ memory.cityName }}
                </span>
            </div>
        </header>

        <section class="memory-card__notes">
            <textarea
                class="memory-card__notes-input"
                :value="memory.notes"
                placeholder="Write the story"
                rows="3"
                @input="handleNotesInput"
            />
        </section>

        <section class="memory-card__media">
            <MemoryMediaGrid
                :media="memory.media"
                @add="$emit('add-media', memory.id, $event)"
                @remove="$emit('remove-media', memory.id, $event)"
            />
        </section>
    </article>
</template>

<script setup lang="ts">
import { nextTick, ref, useTemplateRef } from 'vue';

import type { Memory } from '@/modules/Memory/types/memory.types';
import StarRating from '@/modules/Memory/components/StarRating.vue';
import MemoryMediaGrid from '@/modules/Memory/components/MemoryMediaGrid.vue';

interface Props {
    memory: Memory;
}

const props = defineProps<Props>();
const emit = defineEmits<{
    'update-title': [memoryId: string, title: string];
    'update-notes': [memoryId: string, notes: string];
    'update-rating': [memoryId: string, rating: number];
    'update-visited-at': [memoryId: string, visitedAt: string];
    'add-media': [memoryId: string, mediaUrl: string];
    'remove-media': [memoryId: string, mediaUrl: string];
    delete: [memoryId: string];
}>();

const isEditingTitle = ref(false);
const draftTitle = ref(props.memory.title);
const titleInputRef = useTemplateRef<HTMLInputElement>('titleInputRef');

async function startEditingTitle(): Promise<void> {
    draftTitle.value = props.memory.title;
    isEditingTitle.value = true;
    await nextTick();
    titleInputRef.value?.focus();
    titleInputRef.value?.select();
}

function commitTitle(): void {
    if (!isEditingTitle.value) return;
    const trimmed = draftTitle.value.trim();
    if (trimmed && trimmed !== props.memory.title) {
        emit('update-title', props.memory.id, trimmed);
    }
    isEditingTitle.value = false;
}

function cancelTitle(): void {
    draftTitle.value = props.memory.title;
    isEditingTitle.value = false;
}

function handleRatingChange(rating: number): void {
    emit('update-rating', props.memory.id, rating);
}

function handleNotesInput(event: Event): void {
    const target = event.target as HTMLTextAreaElement;
    emit('update-notes', props.memory.id, target.value);
}

function handleDateChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    if (target.value) emit('update-visited-at', props.memory.id, target.value);
}
</script>

<style lang="scss" scoped>
@use '@/styles/variables' as *;
@use '@/styles/mixins' as *;

.memory-card {
    display: flex;
    flex-direction: column;
    gap: 0.875rem;
    padding: 1.125rem;
    border-radius: $radius-lg;
    background: rgba($color-cosmic-dust, 0.34);
    border: 1px solid rgba($color-aurora, 0.12);
    transition:
        transform $duration-base $ease-cinematic,
        border-color $duration-base $ease-cinematic,
        box-shadow $duration-base $ease-cinematic;
    contain: layout paint;
    content-visibility: auto;
    contain-intrinsic-size: 20rem;

    &:hover {
        border-color: rgba($color-aurora, 0.3);
        transform: translateY(-0.125rem);
        box-shadow: 0 0.375rem 1rem rgba($color-void, 0.2);
    }

    &__title-row {
        display: flex;
        align-items: flex-start;
        gap: 0.5rem;
    }

    &__title {
        flex: 1;
        margin: 0;
        font-size: $font-size-lg;
        font-weight: 600;
        color: $color-text;
        cursor: text;
        line-height: 1.2;

        @include text-glow($color-aurora, 0.3rem);

        &:focus {
            outline: none;
        }
    }

    &__edit-hint {
        opacity: 0;
        margin-left: 0.5rem;
        font-size: $font-size-sm;
        color: $color-text-muted;
        transition: opacity $duration-fast $ease-cinematic;
    }

    &__title:hover &__edit-hint,
    &__title:focus &__edit-hint {
        opacity: 1;
    }

    &__title-input {
        flex: 1;
        background: rgba($color-void, 0.5);
        border: 1px solid rgba($color-aurora, 0.4);
        border-radius: $radius-sm;
        color: $color-text;
        font-size: $font-size-lg;
        font-weight: 600;
        padding: 0.25rem 0.5rem;
        font-family: inherit;

        &:focus {
            outline: none;
            border-color: $color-aurora;
        }
    }

    &__delete {
        background: transparent;
        border: 0;
        color: $color-text-dim;
        font-size: $font-size-base;
        cursor: pointer;
        padding: 0.25rem 0.5rem;
        border-radius: $radius-sm;
        transition:
            color $duration-fast $ease-cinematic,
            background $duration-fast $ease-cinematic;

        &:hover {
            color: #ff8585;
            background: rgba(255, 90, 90, 0.1);
        }
    }

    &__meta {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.875rem;
    }

    &__date {
        display: inline-flex;
        align-items: center;
        gap: 0.375rem;
        color: $color-text-muted;
        font-size: $font-size-xs;
    }

    &__date-label {
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }

    &__date-input {
        background: rgba($color-void, 0.4);
        border: 1px solid rgba($color-aurora, 0.15);
        border-radius: $radius-sm;
        color: $color-text;
        padding: 0.125rem 0.375rem;
        font-family: inherit;
        font-size: $font-size-xs;
        color-scheme: dark;

        &:focus {
            outline: none;
            border-color: rgba($color-aurora, 0.5);
        }
    }

    &__chip {
        padding: 0.125rem 0.5rem;
        border-radius: $radius-pill;
        background: rgba($color-aurora, 0.12);
        color: $color-aurora;
        font-size: $font-size-xs;
        font-weight: 500;
    }

    &__notes-input {
        width: 100%;
        background: rgba($color-void, 0.4);
        border: 1px solid rgba($color-aurora, 0.1);
        border-radius: $radius-md;
        padding: 0.625rem 0.75rem;
        color: $color-text;
        font-family: inherit;
        font-size: $font-size-sm;
        resize: vertical;
        line-height: 1.5;
        transition: border-color $duration-fast $ease-cinematic;

        &::placeholder {
            color: $color-text-dim;
        }

        &:focus {
            outline: none;
            border-color: rgba($color-aurora, 0.4);
        }
    }
}
</style>
