import { API_BASE_URL } from '../config';
import { getStoredUser } from '../utils/storage';

function buildApiUrl(path) {
    if (/^https?:\/\//i.test(path)) {
        return path;
    }

    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return API_BASE_URL ? `${API_BASE_URL}${normalizedPath}` : normalizedPath;
}

async function parseResponse(response) {
    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
        return response.json().catch(() => null);
    }

    return response.text();
}

export async function apiRequest(path, options = {}) {
    const {
        body,
        headers,
        ...restOptions
    } = options;

    const requestHeaders = new Headers(headers || {});
    const currentUser = getStoredUser();

    if (currentUser?.token && !requestHeaders.has('Authorization')) {
        requestHeaders.set('Authorization', `Bearer ${currentUser.token}`);
    }

    const isJsonBody = body !== undefined && !(body instanceof FormData);
    if (isJsonBody && !requestHeaders.has('Content-Type')) {
        requestHeaders.set('Content-Type', 'application/json');
    }

    let response;
    try {
        response = await fetch(buildApiUrl(path), {
            ...restOptions,
            headers: requestHeaders,
            body: body === undefined
                ? undefined
                : body instanceof FormData
                    ? body
                    : JSON.stringify(body),
        });
    } catch (failure) {
        if (failure.name === 'AbortError') throw failure;
        throw new Error('无法连接到服务，请检查网络或本地后端是否正在运行');
    }

    const payload = await parseResponse(response);

    if (!response.ok) {
        const errorMessage =
            (payload && typeof payload === 'object' && payload.error) ||
            (typeof payload === 'string' && payload) ||
            '请求失败';
        const error = new Error(errorMessage);
        error.status = response.status;
        error.payload = payload;
        throw error;
    }

    return payload;
}

export function apiGet(path, options = {}) {
    return apiRequest(path, { ...options, method: 'GET' });
}

export function apiPost(path, body, options = {}) {
    return apiRequest(path, { ...options, method: 'POST', body });
}

export function apiPut(path, body, options = {}) {
    return apiRequest(path, { ...options, method: 'PUT', body });
}

export function apiDelete(path, options = {}) {
    return apiRequest(path, { ...options, method: 'DELETE' });
}
