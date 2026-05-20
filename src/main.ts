import { createApp, vaporInteropPlugin } from 'vue';
import { createPinia } from 'pinia';

import App from './App.vue';
import router from './router';

const app = createApp(App);

// Enable Vapor-in-VDOM interop so `<script setup vapor>` components
// can be rendered transparently inside the VDOM app (incl. RouterView).
app.use(vaporInteropPlugin);
app.use(createPinia());
app.use(router);

app.mount('#app');
