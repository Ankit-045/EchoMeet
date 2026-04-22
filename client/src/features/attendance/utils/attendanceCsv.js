const safeText = (value) => {
  if (value === null || value === undefined) return "";
  return String(value);
};

const escapeCsvCell = (value) => {
  const text = safeText(value);
  const escaped = text.replace(/"/g, '""');
  return `"${escaped}"`;
};

const formatDateTime = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString();
};

const formatDuration = (seconds) => {
  if (!seconds && seconds !== 0) return "";
  const totalSeconds = Math.max(0, Number(seconds));
  const minutes = Math.floor(totalSeconds / 60);
  const secs = Math.floor(totalSeconds % 60);
  return `${minutes}m ${secs}s`;
};

export const generateAttendanceCsv = ({
  attendance,
  stats,
  meetingId
}) => {
  const now = new Date();
  const headerRows = [
    ["Attendance Export"],
    ["Meeting ID", meetingId || ""],
    ["Exported At", now.toLocaleString()],
    ["Total Participants", stats?.totalParticipants ?? attendance.length],
    ["Present", stats?.present ?? ""],
    ["Absent", stats?.absent ?? ""],
    ["Average Duration", formatDuration(stats?.averageDuration)],
    []
  ];

  const columns = [
    "Room ID",
    "User ID",
    "Name",
    "Type",
    "Is Guest",
    "Join Time",
    "Leave Time",
    "Duration (sec)",
    "Total Time (sec)",
    "Duration (formatted)",
    "Status"
  ];

  const rows = (attendance || []).map((item) => [
    item.roomId || meetingId || "",
    item.user || "",
    item.userName || "",
    item.isGuest ? "Guest" : "User",
    item.isGuest ? "Yes" : "No",
    formatDateTime(item.joinTime),
    formatDateTime(item.leaveTime),
    item.duration ?? "",
    item.totalTime ?? item.duration ?? "",
    formatDuration(item.totalTime ?? item.duration),
    item.status || ""
  ]);

  const allRows = [...headerRows, columns, ...rows];
  return allRows.map((row) => row.map(escapeCsvCell).join(",")).join("\n");
};

export const downloadCsv = (csvContent, filename) => {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
