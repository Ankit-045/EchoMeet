import React from "react";
import toast from "react-hot-toast";
import {
  Copy,
  Share2,
  MessageCircle,
  Send,
} from "lucide-react";
import {
  copyMeetingJoinLink,
  getPlatformShareUrl,
  shareMeetingJoinLink,
} from "@features/meeting/share/shareMeeting";
import { isValidMeetingId, normalizeMeetingId } from "@features/meeting/linking/meetingLink";

export default function MeetingShareActions({
  meetingId,
  compact = false,
  className = "",
}) {
  const normalized = normalizeMeetingId(meetingId);

  const ensureValid = () => {
    if (!isValidMeetingId(normalized)) {
      toast.error("Invalid meeting code");
      return false;
    }
    return true;
  };

  const handleCopy = async () => {
    if (!ensureValid()) return;
    try {
      await copyMeetingJoinLink(normalized);
      toast.success("Meeting link copied");
    } catch {
      toast.error("Could not copy link");
    }
  };

  const handleNativeShare = async () => {
    if (!ensureValid()) return;
    try {
      const result = await shareMeetingJoinLink(normalized);
      if (result.method === "native-share-cancelled") return;
      if (result.method === "clipboard-fallback") {
        toast.success("Link copied. You can now paste and share it");
        return;
      }
      toast.success("Share sheet opened");
    } catch {
      toast.error("Could not share meeting link");
    }
  };

  const handlePlatformShare = (platform) => {
    if (!ensureValid()) return;
    try {
      const shareUrl = getPlatformShareUrl(platform, normalized);
      window.open(shareUrl, "_blank", "noopener,noreferrer");
    } catch {
      toast.error("Could not open share option");
    }
  };

  if (compact) {
    return (
      <div className={`flex items-center gap-1 ${className}`}>
        <button
          onClick={handleNativeShare}
          className="p-1.5 rounded-lg hover:bg-dark-700 transition-colors"
          title="Share"
        >
          <Share2 className="w-4 h-4 text-dark-400" />
        </button>
        <button
          onClick={() => handlePlatformShare("whatsapp")}
          className="p-1.5 rounded-lg hover:bg-dark-700 transition-colors"
          title="Share on WhatsApp"
        >
          <MessageCircle className="w-4 h-4 text-green-400" />
        </button>
        <button
          onClick={() => handlePlatformShare("telegram")}
          className="p-1.5 rounded-lg hover:bg-dark-700 transition-colors"
          title="Share on Telegram"
        >
          <Send className="w-4 h-4 text-sky-400" />
        </button>
        <button
          onClick={handleCopy}
          className="p-1.5 rounded-lg hover:bg-dark-700 transition-colors"
          title="Copy link"
        >
          <Copy className="w-4 h-4 text-dark-400" />
        </button>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <button
        onClick={handleNativeShare}
        className="px-3 py-2 rounded-lg bg-primary-500/20 text-primary-300 hover:bg-primary-500/30 transition-colors text-xs font-semibold flex items-center gap-1.5"
      >
        <Share2 className="w-4 h-4" /> Share
      </button>
      <button
        onClick={handleCopy}
        className="px-3 py-2 rounded-lg bg-dark-800 text-dark-200 hover:bg-dark-700 transition-colors text-xs font-semibold flex items-center gap-1.5"
      >
        <Copy className="w-4 h-4" /> Copy Link
      </button>
      <button
        onClick={() => handlePlatformShare("whatsapp")}
        className="px-3 py-2 rounded-lg bg-green-500/20 text-green-300 hover:bg-green-500/30 transition-colors text-xs font-semibold flex items-center gap-1.5"
      >
        <MessageCircle className="w-4 h-4" /> WhatsApp
      </button>
      <button
        onClick={() => handlePlatformShare("telegram")}
        className="px-3 py-2 rounded-lg bg-sky-500/20 text-sky-300 hover:bg-sky-500/30 transition-colors text-xs font-semibold flex items-center gap-1.5"
      >
        <Send className="w-4 h-4" /> Telegram
      </button>
    </div>
  );
}
