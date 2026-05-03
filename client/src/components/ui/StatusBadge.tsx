import React from "react";

interface StatusBadgeProps {
  status?: string; // optional
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  // mapping of status to colors
  const statusMap: Record<string, { text: string; bgColor: string }> = {
    approved: { text: "Approved", bgColor: "bg-green-500" },
    "in-progress": { text: "In Progress", bgColor: "bg-yellow-500" },
    rejected: { text: "Rejected", bgColor: "bg-red-500" },
  };

  // fallback if status is undefined or unknown
  const display = statusMap[status || ""] || { text: "Unknown", bgColor: "bg-gray-400" };

  return (
    <span
      className={`px-2 py-1 text-xs font-semibold text-white rounded ${display.bgColor}`}
    >
      {display.text}
    </span>
  );
};
