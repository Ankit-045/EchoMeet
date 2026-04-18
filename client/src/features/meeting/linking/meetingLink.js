const MEETING_ID_REGEX = /^[A-Z0-9]{4,20}$/;

function stripTrailingSlash(value) {
    return value.replace(/\/+$/, "");
}

export function resolveAppOrigin() {
    const envOrigin = import.meta.env.VITE_PUBLIC_APP_URL;
    if (typeof envOrigin === "string" && envOrigin.trim()) {
        return stripTrailingSlash(envOrigin.trim());
    }

    if (typeof window !== "undefined" && window.location?.origin) {
        return stripTrailingSlash(window.location.origin);
    }

    return "";
}

export function normalizeMeetingId(value) {
    if (!value) return "";
    return String(value).trim().toUpperCase();
}

export function isValidMeetingId(value) {
    const normalized = normalizeMeetingId(value);
    return MEETING_ID_REGEX.test(normalized);
}

export function buildJoinPath(meetingId) {
    const normalized = normalizeMeetingId(meetingId);
    if (!isValidMeetingId(normalized)) {
        throw new Error("Invalid meeting code");
    }
    return `/join/${normalized}`;
}

export function buildJoinUrl(meetingId, origin = resolveAppOrigin()) {
    if (!origin) {
        throw new Error("App origin is not configured");
    }
    return `${origin}${buildJoinPath(meetingId)}`;
}

export function getMeetingIdFromLocation({ pathname, search, routeParam }) {
    const fromParam = normalizeMeetingId(routeParam);
    if (isValidMeetingId(fromParam)) {
        return fromParam;
    }

    const params = new URLSearchParams(search || "");
    const fromQuery = normalizeMeetingId(params.get("meetingId") || params.get("code"));
    if (isValidMeetingId(fromQuery)) {
        return fromQuery;
    }

    const pathMatch = String(pathname || "").match(/\/join\/([^/?#]+)/i);
    const fromPath = normalizeMeetingId(pathMatch?.[1]);
    if (isValidMeetingId(fromPath)) {
        return fromPath;
    }

    return "";
}
