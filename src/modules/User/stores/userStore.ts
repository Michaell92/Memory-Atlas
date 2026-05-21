import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { userLocalGateway } from '@/modules/User/services/userLocalGateway';
import type {
    LoginUserPayload,
    RegisterUserPayload,
    UserAuthMode,
    UserCurrentLocation,
    UserMutationResult,
    UserPanelSection,
    UserRecord,
    UserSettings,
} from '@/modules/User/types/user.types';
import { DEFAULT_USER_SETTINGS, USER_THEME_PALETTES, resolveUserThemePalette } from '@/modules/User/utils/userThemes';

function generateUserId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return `usr-${crypto.randomUUID()}`;
    }
    return `usr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeEmail(email: string): string {
    return email.trim().toLocaleLowerCase();
}

function buildDefaultSettings(): UserSettings {
    return { ...DEFAULT_USER_SETTINGS };
}

function resolveDisplayName(userRecord: UserRecord | null): string {
    if (!userRecord) return 'Traveler';
    const nickname = userRecord.settings.nickname.trim();
    if (nickname.length > 0) return nickname;
    return userRecord.fullName.trim();
}

const persistedUserState = userLocalGateway.load();

export const useUserStore = defineStore('user', () => {
    const users = ref<UserRecord[]>(persistedUserState.users);
    const currentUserId = ref<string | null>(persistedUserState.currentUserId);
    const isAuthDialogOpen = ref(users.value.length === 0);
    const authDialogMode = ref<UserAuthMode>(users.value.length === 0 ? 'register' : 'login');
    const isUserMenuOpen = ref(false);
    const activePanelSection = ref<UserPanelSection | null>(null);

    const currentUser = computed(() => users.value.find((userRecord) => userRecord.id === currentUserId.value) ?? null);
    const isAuthenticated = computed(() => currentUser.value !== null);
    const displayName = computed(() => resolveDisplayName(currentUser.value));
    const currentThemePalette = computed(() =>
        resolveUserThemePalette(currentUser.value?.settings.themeId ?? DEFAULT_USER_SETTINGS.themeId),
    );
    const currentBrightness = computed(
        () => currentUser.value?.settings.brightness ?? DEFAULT_USER_SETTINGS.brightness,
    );
    const currentLocation = computed(() => {
        const settings = currentUser.value?.settings;
        if (
            !settings ||
            !settings.currentLocationCountryCode ||
            !settings.currentLocationCountryName ||
            settings.currentLocationLatitude === null ||
            settings.currentLocationLongitude === null
        ) {
            return null;
        }

        return {
            countryCode: settings.currentLocationCountryCode,
            countryName: settings.currentLocationCountryName,
            cityId: settings.currentLocationCityId || undefined,
            cityName: settings.currentLocationCityName || undefined,
            latitude: settings.currentLocationLatitude,
            longitude: settings.currentLocationLongitude,
        } satisfies UserCurrentLocation;
    });

    function persistUserState(): void {
        userLocalGateway.save({
            users: users.value,
            currentUserId: currentUserId.value,
        });
    }

    function openAuthDialog(mode: UserAuthMode = 'login'): void {
        authDialogMode.value = mode;
        isAuthDialogOpen.value = true;
        isUserMenuOpen.value = false;
    }

    function closeAuthDialog(): void {
        if (!isAuthenticated.value && users.value.length === 0) return;
        isAuthDialogOpen.value = false;
    }

    function setAuthDialogMode(mode: UserAuthMode): void {
        authDialogMode.value = mode;
    }

    function closeUserMenu(): void {
        isUserMenuOpen.value = false;
    }

    function toggleUserMenu(): void {
        if (!isAuthenticated.value) {
            openAuthDialog(users.value.length > 0 ? 'login' : 'register');
            return;
        }
        isUserMenuOpen.value = !isUserMenuOpen.value;
    }

    function openPanel(section: UserPanelSection): void {
        activePanelSection.value = section;
        isUserMenuOpen.value = false;
        isAuthDialogOpen.value = false;
    }

    function closePanel(): void {
        activePanelSection.value = null;
    }

    function registerUser(payload: RegisterUserPayload): UserMutationResult {
        const normalizedEmail = normalizeEmail(payload.email);
        const fullName = payload.fullName.trim();
        const password = payload.password.trim();

        if (fullName.length < 2) {
            return { ok: false, message: 'Tell us the name you want to travel under.' };
        }
        if (!normalizedEmail.includes('@')) {
            return { ok: false, message: 'Use a valid email address.' };
        }
        if (password.length < 6) {
            return { ok: false, message: 'Use at least 6 characters for the password.' };
        }
        if (users.value.some((userRecord) => normalizeEmail(userRecord.email) === normalizedEmail)) {
            return { ok: false, message: 'That email already has a Memory Atlas account.' };
        }

        const createdUser: UserRecord = {
            id: generateUserId(),
            fullName,
            email: normalizedEmail,
            password,
            createdAt: new Date().toISOString(),
            settings: buildDefaultSettings(),
        };

        users.value = [createdUser, ...users.value];
        currentUserId.value = createdUser.id;
        isAuthDialogOpen.value = false;
        activePanelSection.value = null;
        persistUserState();
        return { ok: true };
    }

    function loginUser(payload: LoginUserPayload): UserMutationResult {
        const normalizedEmail = normalizeEmail(payload.email);
        const matchedUser = users.value.find(
            (userRecord) =>
                normalizeEmail(userRecord.email) === normalizedEmail && userRecord.password === payload.password,
        );

        if (!matchedUser) {
            return { ok: false, message: 'We could not match that email and password.' };
        }

        currentUserId.value = matchedUser.id;
        isAuthDialogOpen.value = false;
        activePanelSection.value = null;
        persistUserState();
        return { ok: true };
    }

    function logoutUser(): void {
        currentUserId.value = null;
        activePanelSection.value = null;
        isUserMenuOpen.value = false;
        isAuthDialogOpen.value = true;
        authDialogMode.value = users.value.length === 0 ? 'register' : 'login';
        persistUserState();
    }

    function updateCurrentUserSettings(settingsPatch: Partial<UserSettings>): void {
        const activeUserId = currentUserId.value;
        if (!activeUserId) return;

        users.value = users.value.map((userRecord) => {
            if (userRecord.id !== activeUserId) return userRecord;

            return {
                ...userRecord,
                settings: {
                    ...userRecord.settings,
                    ...settingsPatch,
                },
            };
        });

        persistUserState();
    }

    function setCurrentLocation(location: UserCurrentLocation): void {
        updateCurrentUserSettings({
            currentLocationCountryCode: location.countryCode,
            currentLocationCountryName: location.countryName,
            currentLocationCityId: location.cityId ?? '',
            currentLocationCityName: location.cityName ?? '',
            currentLocationLatitude: location.latitude,
            currentLocationLongitude: location.longitude,
        });
    }

    function clearCurrentLocation(): void {
        updateCurrentUserSettings({
            currentLocationCountryCode: '',
            currentLocationCountryName: '',
            currentLocationCityId: '',
            currentLocationCityName: '',
            currentLocationLatitude: null,
            currentLocationLongitude: null,
        });
    }

    return {
        users,
        currentUserId,
        currentUser,
        isAuthenticated,
        displayName,
        isAuthDialogOpen,
        authDialogMode,
        isUserMenuOpen,
        activePanelSection,
        currentThemePalette,
        currentBrightness,
        currentLocation,
        availableThemes: USER_THEME_PALETTES,
        openAuthDialog,
        closeAuthDialog,
        setAuthDialogMode,
        toggleUserMenu,
        closeUserMenu,
        openPanel,
        closePanel,
        registerUser,
        loginUser,
        logoutUser,
        updateCurrentUserSettings,
        setCurrentLocation,
        clearCurrentLocation,
    };
});
