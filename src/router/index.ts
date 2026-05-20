import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';

import AppLayout from '@/shared/components/AppLayout.vue';

const routes: RouteRecordRaw[] = [
    {
        path: '/',
        component: AppLayout,
        children: [
            {
                path: '',
                name: 'globe',
                // Lazy-load — keep the initial bundle tiny so the globe boots fast.
                component: () => import('@/modules/Globe/views/GlobeView.vue'),
                meta: { title: 'Memory Atlas' },
            },
        ],
    },
    {
        path: '/:pathMatch(.*)*',
        name: 'not-found',
        component: () => import('@/shared/views/NotFoundView.vue'),
        meta: { title: 'Lost in space — Memory Atlas' },
    },
];

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes,
});

router.afterEach((to) => {
    const title = (to.meta?.title as string | undefined) ?? 'Memory Atlas';
    document.title = title;
});

export default router;
