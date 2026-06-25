"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import type { ChatMessage } from "@/types";

interface ChatSession {
  id: string;
  title: string;
  preview: string;
  timestamp: Date;
  messages: ChatMessage[];
}

interface ChatHistoryProps {
  currentMessages: ChatMessage[];
  onLoadSession: (messages: ChatMessage[]) => void;
  onNewChat: () => void;
  isOpen: boolean;
  onClose: () => void;
}

const STORAGE_KEY = "yamu_chat_history";
const MAX_SESSIONS = 20;

export function useChatHistory() {
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return parsed.map((s: ChatSession, index: number) => ({
          ...s,
          id: s.id || `history-${Date.now()}-${index}`,
          timestamp: new Date(s.timestamp),
          messages: s.messages.map((m: ChatMessage) => ({
            ...m,
            timestamp: new Date(m.timestamp),
          })),
        }));
      }
    } catch {}
    return [];
  });

  const saveSession = useCallback((messages: ChatMessage[]) => {
    if (messages.length < 2) return; // don't save empty sessions

    const userMessages = messages.filter((m) => m.role === "user");
    if (userMessages.length === 0) return;

    const firstUserMsg = userMessages[0].content;
    const title =
      firstUserMsg.length > 40
        ? firstUserMsg.slice(0, 40) + "..."
        : firstUserMsg;

    const lastMsg = messages[messages.length - 1];
    const preview =
      lastMsg.content.length > 60
        ? lastMsg.content.slice(0, 60) + "..."
        : lastMsg.content;

    const session: ChatSession = {
      id: Date.now().toString(),
      title,
      preview,
      timestamp: new Date(),
      messages,
    };

    setSessions((prev) => {
      const updated = [session, ...prev].slice(0, MAX_SESSIONS);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  }, []);

  const deleteSession = useCallback((id: string) => {
    setSessions((prev) => {
      const updated = prev.filter((s) => s.id !== id);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  }, []);

  const clearAll = useCallback(() => {
    setSessions([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  }, []);

  return { sessions, saveSession, deleteSession, clearAll };
}

export function ChatHistoryPanel({
  currentMessages,
  onLoadSession,
  onNewChat,
  isOpen,
  onClose,
}: ChatHistoryProps) {
  const { sessions, saveSession, deleteSession, clearAll } = useChatHistory();

  // Auto-save current session when panel opens
  useEffect(() => {
    if (isOpen && currentMessages.length > 1) {
      saveSession(currentMessages);
    }
  }, [currentMessages, isOpen, saveSession]);

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Intl.DateTimeFormat("en-LK", {
      month: "short",
      day: "numeric",
    }).format(new Date(date));
  };

  return (
    <AnimatePresence>
      {isOpen && [
          <motion.div
            key="history-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="backdrop"
          />,

          <motion.div
            key="history-panel"
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className="history-panel"
          >
            {/* Header */}
            <div className="panel-header">
              <div className="panel-title">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "#ff6b35" }}>
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                Chat History
              </div>
              <button onClick={onClose} className="close-btn" aria-label="Close history">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* New chat button */}
            <div className="panel-actions">
              <button onClick={() => { onNewChat(); onClose(); }} className="new-chat-btn">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                New Conversation
              </button>
              {sessions.length > 0 && (
                <button onClick={clearAll} className="clear-btn">
                  Clear all
                </button>
              )}
            </div>

            {/* Sessions list */}
            <div className="sessions-list">
              {sessions.length === 0 ? (
                <div className="empty-state">
                  <div style={{ fontSize: 32, marginBottom: 8 }}>🛍️</div>
                  <p>No previous chats yet.</p>
                  <p style={{ color: "#555", fontSize: 11, marginTop: 4 }}>
                    Your shopping conversations will appear here.
                  </p>
                </div>
              ) : (
                sessions.map((session, index) => (
                  <motion.div
                    key={session.id || `session-${index}`}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="session-item"
                  >
                    <button
                      className="session-main"
                      onClick={() => { onLoadSession(session.messages); onClose(); }}
                    >
                      <div className="session-title">{session.title}</div>
                      <div className="session-preview">{session.preview}</div>
                      <div className="session-meta">
                        <span>{formatTime(session.timestamp)}</span>
                        <span>{session.messages.filter(m => m.role === "user").length} messages</span>
                      </div>
                    </button>
                    <button
                      className="delete-btn"
                      onClick={(e) => { e.stopPropagation(); deleteSession(session.id); }}
                      aria-label="Delete session"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6l-1 14H6L5 6" />
                        <path d="M10 11v6M14 11v6" />
                        <path d="M9 6V4h6v2" />
                      </svg>
                    </button>
                  </motion.div>
                ))
              )}
            </div>
          </motion.div>
      ]}

      <style>{`
        .backdrop {
          position: fixed;
          inset: 0;
          background: #00000080;
          z-index: 40;
        }
        .history-panel {
          position: fixed;
          top: 0; left: 0; bottom: 0;
          width: 300px;
          max-width: 85vw;
          background: #111;
          border-right: 0.5px solid #2a2a2a;
          z-index: 50;
          display: flex;
          flex-direction: column;
          font-family: 'DM Sans', sans-serif;
        }
        .panel-header {
          padding: 16px 16px 12px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 0.5px solid #1e1e1e;
          flex-shrink: 0;
        }
        .panel-title {
          color: #e8e8e8;
          font-size: 14px;
          font-weight: 500;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .close-btn {
          background: none;
          border: none;
          color: #7b7979;
          cursor: pointer;
          padding: 4px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          transition: color 0.15s;
        }
        .close-btn:hover { color: #ff0000; }

        .panel-actions {
          padding: 12px 14px;
          display: flex;
          gap: 8px;
          align-items: center;
          border-bottom: 0.5px solid #1a1a1a;
          flex-shrink: 0;
        }
        .new-chat-btn {
          flex: 1;
          background: #ff6b35;
          color: #fff;
          border: none;
          padding: 8px 14px;
          border-radius: 10px;
          font-size: 12px;
          font-weight: 500;
          font-family: 'DM Sans', sans-serif;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          transition: background 0.15s;
        }
        .new-chat-btn:hover { background: #e85c28; }
        .clear-btn {
          background: none;
          border: 0.5px solid #2a2a2a;
          color: #666;
          padding: 8px 12px;
          border-radius: 10px;
          font-size: 11px;
          font-family: 'DM Sans', sans-serif;
          cursor: pointer;
          transition: color 0.15s, border-color 0.15s;
        }
        .clear-btn:hover { color: #ff4444; border-color: #ff444440; }

        .sessions-list {
          flex: 1;
          overflow-y: auto;
          padding: 8px;
          scrollbar-width: thin;
          scrollbar-color: #2a2a2a transparent;
        }
        .empty-state {
          padding: 40px 20px;
          text-align: center;
          color: #888;
          font-size: 13px;
        }
        .session-item {
          display: flex;
          align-items: stretch;
          border-radius: 10px;
          margin-bottom: 4px;
          overflow: hidden;
          border: 0.5px solid transparent;
          transition: border-color 0.15s;
        }
        .session-item:hover { border-color: #2a2a2a; }
        .session-main {
          flex: 1;
          background: none;
          border: none;
          padding: 10px 12px;
          text-align: left;
          cursor: pointer;
          border-radius: 10px 0 0 10px;
          transition: background 0.15s;
        }
        .session-main:hover { background: #1a1a1a; }
        .session-title {
          color: #d4d4d4;
          font-size: 12.5px;
          font-weight: 500;
          font-family: 'DM Sans', sans-serif;
          margin-bottom: 3px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 200px;
        }
        .session-preview {
          color: #666;
          font-size: 11px;
          font-family: 'DM Sans', sans-serif;
          line-height: 1.4;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          margin-bottom: 5px;
        }
        .session-meta {
          display: flex;
          gap: 10px;
          color: #444;
          font-size: 10px;
          font-family: 'DM Sans', sans-serif;
        }
        .delete-btn {
          background: none;
          border: none;
          color: #444;
          padding: 0 10px;
          cursor: pointer;
          border-radius: 0 10px 10px 0;
          transition: color 0.15s, background 0.15s;
          display: flex;
          align-items: center;
        }
        .delete-btn:hover { color: #ff4444; background: #1a1a1a; }
      `}</style>
    </AnimatePresence>
  );
}
