import { ref } from 'vue';

interface CountryUnlockCelebrationState {
    countryCode: string;
    countryName: string;
    token: string;
}

const activeCelebration = ref<CountryUnlockCelebrationState | null>(null);

let clearCelebrationTimeoutId: ReturnType<typeof setTimeout> | null = null;

function triggerCelebration(countryCode: string, countryName: string): void {
    activeCelebration.value = {
        countryCode,
        countryName,
        token: `${countryCode}-${Date.now()}`,
    };

    if (clearCelebrationTimeoutId !== null) {
        clearTimeout(clearCelebrationTimeoutId);
    }

    clearCelebrationTimeoutId = setTimeout(() => {
        activeCelebration.value = null;
        clearCelebrationTimeoutId = null;
    }, 3600);
}

export function useCountryUnlockCelebration() {
    return {
        activeCelebration,
        triggerCelebration,
    };
}
