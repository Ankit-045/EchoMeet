import {
  buildJoinUrl,
  isValidMeetingId,
  normalizeMeetingId,
} from "@features/meeting/linking/meetingLink";

function legacyClipboardWrite(text) {
  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.setAttribute("readonly", "");
  textArea.style.position = "fixed";
  textArea.style.left = "-9999px";
  document.body.appendChild(textArea);
  textArea.select();

  let copied = false;
  try {
    copied = document.execCommand("copy");
  } finally {
    document.body.removeChild(textArea);
  }

  if (!copied) {
    throw new Error("Copy command failed");
  }
}

export async function copyMeetingJoinLink(meetingId) {
  const normalized = normalizeMeetingId(meetingId);
  if (!isValidMeetingId(normalized)) {
    throw new Error("Invalid meeting code");
  }

  const url = buildJoinUrl(normalized);

  if (navigator.clipboard?.writeText && window.isSecureContext) {
    await navigator.clipboard.writeText(url);
    return { url, method: "clipboard" };
  }

  legacyClipboardWrite(url);
  return { url, method: "execCommand" };
}

export async function shareMeetingJoinLink(
  meetingId,
  {
    title = "Join my EchoMeet meeting",
    text = "Use this link to join the meeting",
  } = {},
) {
  const normalized = normalizeMeetingId(meetingId);
  if (!isValidMeetingId(normalized)) {
    throw new Error("Invalid meeting code");
  }

  const url = buildJoinUrl(normalized);

  if (navigator.share) {
    try {
      await navigator.share({ title, text, url });
      return { url, method: "native-share" };
    } catch (error) {
      if (error?.name === "AbortError") {
        return { url, method: "native-share-cancelled" };
      }
    }
  }

  const copied = await copyMeetingJoinLink(normalized);
  return { ...copied, method: "clipboard-fallback" };
}

export function getPlatformShareUrl(platform, meetingId) {
  const normalized = normalizeMeetingId(meetingId);
  if (!isValidMeetingId(normalized)) {
    throw new Error("Invalid meeting code");
  }

  const url = buildJoinUrl(normalized);
  const message = encodeURIComponent(`Join my EchoMeet meeting: ${url}`);

  if (platform === "whatsapp") {
    return `https://wa.me/?text=${message}`;
  }

  if (platform === "telegram") {
    return `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent("Join my EchoMeet meeting")}`;
  }

  throw new Error("Unsupported platform");
}
