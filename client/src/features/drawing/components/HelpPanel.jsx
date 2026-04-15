import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, HelpCircle } from "lucide-react";

const gestures = [
  {
    section: "Right Hand (Draw)",
    items: [
      { emoji: "[Draw]", gesture: "Index finger up", action: "Draw strokes" },
      { emoji: "[Erase]", gesture: "Pinch (thumb + index)", action: "Erase nearby strokes" },
      { emoji: "[Clear]", gesture: "Fist", action: "Clear all" },
    ],
  },
  {
    section: "Left Hand (Control)",
    items: [
      { emoji: "[Move]", gesture: "Two fingers up", action: "Select and move stroke" },
      { emoji: "[Scale]", gesture: "Pinch + spread/close", action: "Scale stroke" },
      { emoji: "[Rotate]", gesture: "Open palm + twist", action: "Rotate stroke" },
    ],
  },
  {
    section: "Tips",
    items: [
      { emoji: "[Tip]", gesture: "One hand only", action: "Auto-assigned as draw hand" },
      { emoji: "[Tip]", gesture: "Release rotate", action: "Snaps to nearest 45 degrees" },
    ],
  },
];

export default function HelpPanel({ isOpen, onClose }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 120,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(0, 0, 0, 0.6)",
            backdropFilter: "blur(8px)",
          }}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="glass-meta"
            style={{
              width: "380px",
              maxHeight: "80vh",
              overflowY: "auto",
              borderRadius: "20px",
              padding: "24px",
              color: "#fff",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "20px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <HelpCircle size={20} style={{ color: "#00ffff" }} />
                <span style={{ fontSize: "16px", fontWeight: 700, letterSpacing: "0.05em" }}>
                  Gesture Guide
                </span>
              </div>
              <button
                onClick={onClose}
                style={{
                  background: "none",
                  border: "none",
                  color: "rgba(255,255,255,0.6)",
                  cursor: "pointer",
                  padding: "4px",
                  display: "flex",
                }}
              >
                <X size={18} />
              </button>
            </div>

            {gestures.map((section, sIdx) => (
              <div key={sIdx} style={{ marginBottom: sIdx < gestures.length - 1 ? "16px" : 0 }}>
                <div
                  style={{
                    fontSize: "11px",
                    fontWeight: 600,
                    color: "rgba(255, 255, 255, 0.45)",
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    marginBottom: "8px",
                  }}
                >
                  {section.section}
                </div>
                {section.items.map((item, iIdx) => (
                  <div
                    key={iIdx}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      padding: "8px 10px",
                      borderRadius: "10px",
                      marginBottom: "4px",
                      backgroundColor: "rgba(255, 255, 255, 0.04)",
                    }}
                  >
                    <span style={{ fontSize: "20px", width: "28px", textAlign: "center" }}>
                      {item.emoji}
                    </span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: "13px", fontWeight: 600 }}>{item.gesture}</div>
                      <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)" }}>
                        {item.action}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
