import { fileURLToPath, URL } from 'node:url';

import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import vueDevTools from 'vite-plugin-vue-devtools';

// https://vite.dev/config/
export default defineConfig({
    plugins: [vue(), vueDevTools()],
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url)),
        },
    },
    css: {
        preprocessorOptions: {
            scss: {
                // Auto-injected into every <style lang="scss"> block in components.
                // Use $color-void, @include glow(...) etc. without explicit @use.
                additionalData: `
          @use "@/styles/variables" as *;
          @use "@/styles/mixins" as *;
        `,
            },
        },
    },
});
