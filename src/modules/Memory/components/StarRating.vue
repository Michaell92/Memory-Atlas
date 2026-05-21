<template>
    <div
        class="star-rating"
        :class="{ 'star-rating--readonly': readonly }"
        role="radiogroup"
        :aria-label="`Rating: ${modelValue} of 5 stars`"
    >
        <button
            v-for="starIndex in 5"
            :key="starIndex"
            type="button"
            class="star-rating__star"
            :class="{ 'star-rating__star--filled': starIndex <= hoverOrValue }"
            :disabled="readonly"
            :aria-label="`${starIndex} star${starIndex === 1 ? '' : 's'}`"
            :aria-checked="starIndex === modelValue"
            role="radio"
            @click="selectStar(starIndex)"
            @mouseenter="hoveredStar = starIndex"
            @mouseleave="hoveredStar = 0"
        >
            <svg viewBox="0 0 24 24" class="star-rating__icon" aria-hidden="true">
                <path
                    d="M12 2.5l2.95 6.36 7.05.78-5.25 4.78 1.5 6.93L12 17.77 5.75 21.35l1.5-6.93L2 9.64l7.05-.78L12 2.5z"
                />
            </svg>
        </button>
    </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';

interface Props {
    modelValue: number;
    readonly?: boolean;
}

const props = withDefaults(defineProps<Props>(), { readonly: false });
const emit = defineEmits<{ 'update:modelValue': [value: number] }>();

const hoveredStar = ref(0);

const hoverOrValue = computed(() => (!props.readonly && hoveredStar.value > 0 ? hoveredStar.value : props.modelValue));

function selectStar(starIndex: number): void {
    if (props.readonly) return;
    // Click the current rating to clear it.
    emit('update:modelValue', starIndex === props.modelValue ? 0 : starIndex);
}
</script>

<style lang="scss" scoped>
@use '@/styles/variables' as *;

.star-rating {
    display: inline-flex;
    gap: 0.125rem;

    &--readonly &__star {
        cursor: default;
    }

    &__star {
        background: transparent;
        border: 0;
        padding: 0.125rem;
        cursor: pointer;
        color: rgba($color-text-dim, 0.6);
        transition:
            color $duration-fast $ease-cinematic,
            transform $duration-fast $ease-cinematic;

        &:hover:not(:disabled) {
            transform: scale(1.15);
        }

        &--filled {
            color: $color-memory;
            filter: drop-shadow(0 0 0.3rem rgba($color-memory, 0.6));
        }
    }

    &__icon {
        width: 1.25rem;
        height: 1.25rem;
        fill: currentColor;
        display: block;
    }
}
</style>
