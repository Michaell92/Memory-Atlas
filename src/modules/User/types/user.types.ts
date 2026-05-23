import type { AchievementState } from '@/modules/Achievements/types/achievement.types';

export type UserAuthMode = 'login' | 'register';

export type UserPanelSection = 'overview' | 'memories' | 'settings';

export interface UserThemePalette {
    id: string;
    name: string;
    tagline: string;
    ui: {
        backgroundStart: string;
        backgroundMid: string;
        backgroundEnd: string;
        surface: string;
        surfaceBorder: string;
        accent: string;
        accentSoft: string;
        text: string;
        textMuted: string;
    };
    globe: {
        background: string;
        globeColor: string;
        globeEmissive: string;
        atmosphereColor: string;
        atmosphereNightColor: string;
        ambientLight: string;
        sunLight: string;
    };
}

export interface UserSettings {
    themeId: string;
    brightness: number;
    nickname: string;
    yearOfBirth: string;
    homeCountryCode: string;
    homeCountryName: string;
    homeCityId: string;
    homeCityName: string;
    currentLocationCountryCode: string;
    currentLocationCountryName: string;
    currentLocationCityId: string;
    currentLocationCityName: string;
    currentLocationLatitude: number | null;
    currentLocationLongitude: number | null;
    achievementState: AchievementState;
}

export interface UserCurrentLocation {
    countryCode: string;
    countryName: string;
    cityId?: string;
    cityName?: string;
    latitude: number;
    longitude: number;
}

export interface UserRecord {
    id: string;
    fullName: string;
    email: string;
    password: string;
    createdAt: string;
    settings: UserSettings;
}

export interface PersistedUserState {
    users: UserRecord[];
    currentUserId: string | null;
}

export interface RegisterUserPayload {
    fullName: string;
    email: string;
    password: string;
}

export interface LoginUserPayload {
    email: string;
    password: string;
}

export interface UserMutationResult {
    ok: boolean;
    message?: string;
}

export interface UserSearchOption {
    id: string;
    label: string;
    description?: string;
    latitude?: number;
    longitude?: number;
    countryCode?: string;
    countryName?: string;
}
