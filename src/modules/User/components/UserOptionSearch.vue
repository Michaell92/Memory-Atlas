<template>
    <div ref="searchRootRef" class="user-option-search" :class="{ 'user-option-search--disabled': disabled }">
        <label class="user-option-search__label">{{ label }}</label>
        <div class="user-option-search__field" :class="{ 'user-option-search__field--open': isOpen }">
            <input
                v-model="searchQuery"
                class="user-option-search__input"
                type="text"
                :placeholder="placeholder"
                :disabled="disabled"
                @focus="isOpen = true"
            />
            <button
                v-if="selectedOption"
                type="button"
                class="user-option-search__clear"
                aria-label="Clear selection"
                @click="clearSelection"
            >
                ×
            </button>
        </div>

        <div v-if="isOpen && !disabled" class="user-option-search__dropdown">
            <button
                v-for="option in filteredOptions"
                :key="option.id"
                type="button"
                class="user-option-search__option"
                :class="{ 'user-option-search__option--selected': option.id === selectedId }"
                @click="selectOption(option)"
            >
                <span class="user-option-search__option-label">{{ option.label }}</span>
                <span v-if="option.description" class="user-option-search__option-description">
                    {{ option.description }}
                </span>
            </button>

            <p v-if="filteredOptions.length === 0" class="user-option-search__empty">
                {{ emptyLabel }}
            </p>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, useTemplateRef, watch } from 'vue';

import type { UserSearchOption } from '@/modules/User/types/user.types';

interface Props {
    label: string;
    placeholder: string;
    options: UserSearchOption[];
    selectedId: string;
    disabled?: boolean;
    emptyLabel?: string;
}

const props = withDefaults(defineProps<Props>(), {
    disabled: false,
    emptyLabel: 'No matches yet.',
});

const emit = defineEmits<{
    select: [option: UserSearchOption];
    clear: [];
}>();

const searchRootRef = useTemplateRef<HTMLDivElement>('searchRootRef');
const searchQuery = ref('');
const isOpen = ref(false);

const selectedOption = computed(() => props.options.find((option) => option.id === props.selectedId) ?? null);

const filteredOptions = computed(() => {
    const normalizedQuery = searchQuery.value.trim().toLocaleLowerCase();
    if (!normalizedQuery) return props.options.slice(0, 12);

    return props.options
        .filter((option) => {
            const normalizedLabel = option.label.toLocaleLowerCase();
            const normalizedDescription = option.description?.toLocaleLowerCase() ?? '';
            return normalizedLabel.includes(normalizedQuery) || normalizedDescription.includes(normalizedQuery);
        })
        .slice(0, 20);
});

watch(
    selectedOption,
    (nextSelectedOption) => {
        searchQuery.value = nextSelectedOption?.label ?? '';
    },
    { immediate: true },
);

function selectOption(option: UserSearchOption): void {
    emit('select', option);
    isOpen.value = false;
}

function clearSelection(): void {
    searchQuery.value = '';
    emit('clear');
    isOpen.value = true;
}

function handleDocumentPointerDown(event: PointerEvent): void {
    if (!searchRootRef.value) return;
    if (searchRootRef.value.contains(event.target as Node)) return;
    isOpen.value = false;
}

onMounted(() => {
    document.addEventListener('pointerdown', handleDocumentPointerDown);
});

onUnmounted(() => {
    document.removeEventListener('pointerdown', handleDocumentPointerDown);
});
</script>

<style lang="scss" scoped>
.user-option-search {
    position: relative;
    display: grid;
    gap: 0.5rem;

    &--disabled {
        opacity: 0.55;
    }

    &__label {
        font-size: 0.75rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--theme-text-muted);
    }

    &__field {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        min-height: 3rem;
        padding: 0 0.875rem;
        border-radius: 1rem;
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.08);
        transition:
            border-color 180ms ease,
            box-shadow 180ms ease,
            transform 180ms ease;

        &--open {
            border-color: color-mix(in srgb, var(--theme-accent) 58%, transparent);
            box-shadow: 0 0 0 0.125rem color-mix(in srgb, var(--theme-accent) 16%, transparent);
            transform: translateY(-0.0625rem);
        }
    }

    &__input {
        width: 100%;
        border: 0;
        background: transparent;
        color: var(--theme-text);
        font: inherit;

        &:focus {
            outline: none;
        }
    }

    &__clear {
        border: 0;
        background: transparent;
        color: var(--theme-text-muted);
        font-size: 1.125rem;
        cursor: pointer;
    }

    &__dropdown {
        position: absolute;
        top: calc(100% + 0.5rem);
        left: 0;
        right: 0;
        z-index: 2;
        display: grid;
        gap: 0.375rem;
        max-height: 16rem;
        padding: 0.625rem;
        overflow-y: auto;
        border-radius: 1rem;
        background: color-mix(in srgb, var(--theme-surface) 88%, #02030a);
        border: 1px solid color-mix(in srgb, var(--theme-accent) 18%, transparent);
        box-shadow: 0 1rem 2.5rem rgba(0, 0, 0, 0.28);
        backdrop-filter: blur(1.25rem) saturate(1.3);
    }

    &__option {
        display: grid;
        gap: 0.125rem;
        padding: 0.75rem 0.875rem;
        border-radius: 0.875rem;
        border: 1px solid transparent;
        background: rgba(255, 255, 255, 0.03);
        color: var(--theme-text);
        text-align: left;
        cursor: pointer;
        transition:
            transform 180ms ease,
            border-color 180ms ease,
            background 180ms ease;

        &:hover,
        &--selected {
            transform: translateY(-0.0625rem);
            border-color: color-mix(in srgb, var(--theme-accent) 35%, transparent);
            background: color-mix(in srgb, var(--theme-accent-soft) 80%, rgba(255, 255, 255, 0.04));
        }
    }

    &__option-label {
        font-weight: 600;
    }

    &__option-description,
    &__empty {
        font-size: 0.875rem;
        color: var(--theme-text-muted);
    }
}
</style>
