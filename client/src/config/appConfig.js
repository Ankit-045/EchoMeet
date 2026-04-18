function stripTrailingSlash(value) {
    return value.replace(/\/+$/, "");
}

function resolveFallbackOrigin() {
    if (typeof window !== "undefined" && window.location?.origin) {
        return stripTrailingSlash(window.location.origin);
    }
    return "";
}

const envBaseUrl = import.meta.env.VITE_PUBLIC_APP_URL;

export const APP_BASE_URL =
    typeof envBaseUrl === "string" && envBaseUrl.trim()
        ? stripTrailingSlash(envBaseUrl.trim())
        : resolveFallbackOrigin();
