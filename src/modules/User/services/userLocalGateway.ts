import type { PersistedUserState } from '@/modules/User/types/user.types';

export interface UserStateGateway {
    load: () => PersistedUserState;
    save: (state: PersistedUserState) => void;
}

const STORAGE_KEY = 'memory-atlas.user-state.v1';

const EMPTY_STATE: PersistedUserState = {
    users: [],
    currentUserId: null,
};

function isBrowserEnvironment(): boolean {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export const userLocalGateway: UserStateGateway = {
    load(): PersistedUserState {
        if (!isBrowserEnvironment()) return EMPTY_STATE;

        const rawValue = window.localStorage.getItem(STORAGE_KEY);
        if (!rawValue) return EMPTY_STATE;

        try {
            const parsed = JSON.parse(rawValue) as Partial<PersistedUserState>;
            return {
                users: Array.isArray(parsed.users) ? parsed.users : [],
                currentUserId: typeof parsed.currentUserId === 'string' ? parsed.currentUserId : null,
            };
        } catch {
            return EMPTY_STATE;
        }
    },

    save(state: PersistedUserState): void {
        if (!isBrowserEnvironment()) return;
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    },
};
