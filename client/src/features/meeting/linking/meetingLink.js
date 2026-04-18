const MEETING_ID_REGEX = /^[A-Z0-9]{4,20}$/;

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

export function buildJoinUrl(meetingId, origin = window.location.origin) {
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
