<template>
    <div class="memory-media-grid">
        <div v-for="mediaUrl in media" :key="mediaUrl" class="memory-media-grid__tile">
            <img :src="mediaUrl" alt="Memory media" class="memory-media-grid__image" />
            <button
                type="button"
                class="memory-media-grid__remove"
                aria-label="Remove picture"
                @click="$emit('remove', mediaUrl)"
            >
                ×
            </button>
        </div>

        <label class="memory-media-grid__add">
            <input type="file" accept="image/*" multiple class="memory-media-grid__add-input" @change="handleFiles" />
            <span class="memory-media-grid__add-icon" aria-hidden="true">+</span>
            <span class="memory-media-grid__add-label">Add picture</span>
        </label>
    </div>
</template>

<script setup lang="ts">
interface Props {
    media: string[];
}

defineProps<Props>();
const emit = defineEmits<{
    add: [mediaUrl: string];
    remove: [mediaUrl: string];
}>();

function handleFiles(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files) return;
    for (const file of Array.from(input.files)) {
        const reader = new FileReader();
        reader.onload = () => {
            if (typeof reader.result === 'string') {
                emit('add', reader.result);
            }
        };
        reader.readAsDataURL(file);
    }
    input.value = '';
}
</script>

<style lang="scss" scoped>
@use '@/styles/variables' as *;

.memory-media-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(6rem, 1fr));
    gap: 0.5rem;

    &__tile {
        position: relative;
        aspect-ratio: 1;
        border-radius: $radius-md;
        overflow: hidden;
        border: 1px solid rgba($color-aurora, 0.15);
        background: rgba($color-void, 0.4);
    }

    &__image {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
    }

    &__remove {
        position: absolute;
        top: 0.25rem;
        right: 0.25rem;
        width: 1.5rem;
        height: 1.5rem;
        border-radius: 50%;
        border: 0;
        background: rgba($color-void, 0.8);
        color: $color-text;
        font-size: 1rem;
        line-height: 1;
        cursor: pointer;
        opacity: 0;
        transition:
            opacity $duration-fast $ease-cinematic,
            background $duration-fast $ease-cinematic;

        &:hover {
            background: rgba(255, 90, 90, 0.85);
        }
    }

    &__tile:hover &__remove {
        opacity: 1;
    }

    &__add {
        @include flex-center;
        flex-direction: column;
        gap: 0.25rem;
        aspect-ratio: 1;
        border-radius: $radius-md;
        border: 1px dashed rgba($color-aurora, 0.35);
        background: rgba($color-aurora, 0.04);
        color: $color-text-muted;
        cursor: pointer;
        transition:
            border-color $duration-fast $ease-cinematic,
            background $duration-fast $ease-cinematic,
            color $duration-fast $ease-cinematic;

        &:hover {
            border-color: rgba($color-aurora, 0.7);
            background: rgba($color-aurora, 0.08);
            color: $color-aurora;
        }
    }

    &__add-input {
        display: none;
    }

    &__add-icon {
        font-size: 1.5rem;
        font-weight: 200;
        line-height: 1;
    }

    &__add-label {
        font-size: $font-size-xs;
    }
}
</style>
