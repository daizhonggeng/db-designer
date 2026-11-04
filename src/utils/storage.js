const USER_STORAGE_KEY = 'user';

function isBrowser() {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function getStoredUser() {
    if (!isBrowser()) {
        return null;
    }

    const rawValue = window.localStorage.getItem(USER_STORAGE_KEY);
    if (!rawValue) {
        return null;
    }

    try {
        const parsedUser = JSON.parse(rawValue);
        const userId = Number(parsedUser?.id);

        if (
            !Number.isInteger(userId) ||
            userId <= 0 ||
            !parsedUser?.username ||
            !parsedUser?.token
        ) {
            window.localStorage.removeItem(USER_STORAGE_KEY);
            return null;
        }

        return {
            ...parsedUser,
            id: userId,
        };
    } catch {
        window.localStorage.removeItem(USER_STORAGE_KEY);
        return null;
    }
}

export function setStoredUser(user) {
    if (!isBrowser()) {
        return;
    }

    window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
}

export function clearStoredUser() {
    if (!isBrowser()) {
        return;
    }

    window.localStorage.removeItem(USER_STORAGE_KEY);
}
