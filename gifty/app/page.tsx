"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { AnimatePresence } from "framer-motion";
import { ChatBubble, TypingIndicator } from "@/components/ChatBubble";
import { CartPill } from "@/components/CartPill";
import { CartDetails } from "@/components/CartDetails";
import { useSessionStore } from "@/lib/session";
import type { ChatMessage, Product } from "@/types";

const WELCOME_MESSAGE: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "ආයුබෝවන්! I'm GIFTY 🛍️\nKapruka's shopping guide for Sri Lanka.\n\nTell me what you're looking for — a gift, something for yourself, or just browsing?",
  timestamp: new Date(),
};

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showCartDetails, setShowCartDetails] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const sessionStore = useSessionStore();
  const resetSession = useSessionStore((s) => s.resetSession);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const sendMessage = useCallback(
    async (text?: string) => {
      const content = (text || input).trim();
      if (!content || isLoading) return;

      setInput("");

      const userMsg: ChatMessage = {
        id: Date.now().toString(),
        role: "user",
        content,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);

      try {
        const historyMessages = [...messages, userMsg]
          .filter((m) => m.id !== "welcome")
          .slice(-12) // keep last 12 for context window
          .map((m) => ({ role: m.role, content: m.content }));

        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: historyMessages,
            sessionData: sessionStore.toSessionData(),
          }),
        });

        const data = await res.json();

        if (data.error) throw new Error(data.error);

        // Check if Claude is asking for address/name/phone and auto-populate session
        autoPopulateSession(content, data.text);

        const assistantMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: data.text,
          products: data.products,
          order: data.order,
          timestamp: new Date(),
          language: data.language,
        };

        setMessages((prev) => [...prev, assistantMsg]);
      } catch (err) {
        const errorMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: "Sorry, something went wrong 😅 Try again?",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMsg]);
      } finally {
        setIsLoading(false);
        inputRef.current?.focus();
      }
    },
    [input, isLoading, messages, sessionStore]
  );

  const handleCheckout = useCallback(() => {
    const msg = "I'd like to checkout my cart";
    setInput(msg);
    setTimeout(() => sendMessage(msg), 100);
  }, [sendMessage]);

  const handleNewChat = useCallback(() => {
    resetSession();
    setMessages([WELCOME_MESSAGE]);
    setInput("");
    setShowCartDetails(false);
    inputRef.current?.focus();
  }, [resetSession]);

  // Heuristic: auto-populate session fields from user messages
  function autoPopulateSession(userText: string, agentText: string) {
    // Detect if agent asked for address and user just provided one
    if (
      agentText.toLowerCase().includes("address") ||
      agentText.toLowerCase().includes("deliver")
    ) {
      if (
        userText.match(/\d+.*road|street|lane|place|avenue|colombo|kandy|galle/i) ||
        userText.length > 15
      ) {
        sessionStore.setAddress(userText);
      }
    }

    // Phone number detection
    const phoneMatch = userText.match(/0[17]\d{8}/);
    if (phoneMatch) sessionStore.setRecipientPhone(phoneMatch[0]);

    // Morning/evening delivery
    if (/morning|before 12|am\b/i.test(userText)) sessionStore.setDeliveryTime("morning");
    if (/evening|afternoon|after 12|pm\b/i.test(userText)) sessionStore.setDeliveryTime("afternoon");
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const quickReplies = [
    "Gift for amma 🎂",
    "Flowers delivery",
    "Romantic gift 💕",
    "Under Rs. 3000",
  ];

  return (
    <div className="shell">
      <div className="layout-grid">
        <aside className="sidebar">
          <div className="sidebar-brand">
            <div className="sidebar-logo">
              <img src="/gifty-logo.png" alt="GIFTY" width="30" height="30" />
            </div>
            <div>
              <div className="sidebar-name">GIFTY</div>
              <div className="sidebar-tag">Kapruka chat shopping</div>
            </div>
          </div>

          <button type="button" className="new-chat-btn" onClick={handleNewChat}>
            + New Conversation
          </button>

          <div className="sidebar-section">
            <div className="sidebar-section-title">Starter prompts</div>
            <div className="sidebar-prompts">
              {quickReplies.map((qr) => (
                <button
                  key={qr}
                  type="button"
                  className="sidebar-prompt"
                  onClick={() => sendMessage(qr)}
                >
                  {qr}
                </button>
              ))}
            </div>
          </div>

          <div className="sidebar-section">
            <div className="sidebar-section-title">Why GIFTY?</div>
            <p className="sidebar-note">
              Discover gifts fast, shop with Sinhala/Tanglish support, and complete checkout in chat.
            </p>
          </div>
        </aside>

        <section className="chat-panel">
          <header className="header">
            <div className="header-brand">
              <div className="yamu-logo">
                <img src="/gifty-logo.png" alt="GIFTY" />
              </div>
              <div>
                <h1 className="brand-name">GIFTY</h1>
                <div className="brand-sub">
                  <span className="online-dot" aria-hidden="true" />
                  by Kapruka
                </div>
              </div>
            </div>
            <div className="header-right">
              <span className="lang-badge">සිං EN த</span>
            </div>
          </header>

          <main className="chat-area" role="log" aria-label="Chat messages" aria-live="polite">
            <div className="messages-inner">
              {messages.map((msg, i) => (
                <ChatBubble
                  key={msg.id}
                  message={msg}
                  isLatest={i === messages.length - 1}
                />
              ))}

              <AnimatePresence>
                {isLoading && <TypingIndicator />}
              </AnimatePresence>

              <div ref={bottomRef} />
            </div>
          </main>

          {messages.length <= 2 && !isLoading && (
            <div className="quick-replies" role="group" aria-label="Quick reply suggestions">
              {quickReplies.map((qr) => (
                <button
                  key={qr}
                  onClick={() => sendMessage(qr)}
                  className="quick-reply-btn"
                >
                  {qr}
                </button>
              ))}
            </div>
          )}

          <div className="cart-area">
            <CartPill
              onCheckout={handleCheckout}
              onReview={() => setShowCartDetails((open) => !open)}
            />
            {showCartDetails && <CartDetails />}
          </div>

          <div className="input-area">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message GIFTY... (English, සිංහල, Tamil, Tanglish)"
              className="chat-input"
              aria-label="Type a message"
              disabled={isLoading}
              autoFocus
            />
            <button
              onClick={() => sendMessage()}
              className="send-btn"
              disabled={!input.trim() || isLoading}
              aria-label="Send message"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="12" y1="19" x2="12" y2="5" />
                <polyline points="5 12 12 5 19 12" />
              </svg>
            </button>
          </div>
        </section>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,400&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        body, html { height: 100%; overflow: hidden; background: #050305; }

        .shell {
          min-height: 100dvh;
          display: flex;
          align-items: stretch;
          justify-content: center;
          background: radial-gradient(circle at top, rgba(255, 107, 53, 0.08), transparent 30%), #0a050f;
          font-family: 'DM Sans', sans-serif;
          padding: 14px;
        }

        .layout-grid {
          width: 100%;
          max-width: 1280px;
          display: grid;
          grid-template-columns: 280px minmax(0, 1fr);
          gap: 20px;
          align-items: stretch;
        }

        .sidebar {
          display: flex;
          flex-direction: column;
          gap: 20px;
          background: #0e0813;
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 28px;
          padding: 22px;
          min-height: calc(100dvh - 28px);
          position: sticky;
          top: 14px;
        }

        .sidebar-brand {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .sidebar-logo {
          width: 70px;
          height: 44px;
          border-radius: 16px;
          background: linear-gradient(135deg, #ff6b35, #ff9500);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          font-weight: 700;
          font-size: 18px;
        }
        .sidebar-logo img {
          width: 70px;
          height: 44px;
          border-radius: 12px;
          object-fit: cover;
        }

        .sidebar-name {
          color: #fff;
          font-size: 18px;
          font-weight: 700;
        }

        .sidebar-tag {
          color: #a3a3a3;
          font-size: 12px;
          line-height: 1.4;
        }

        .new-chat-btn {
          background: linear-gradient(135deg, #880cdc, #bcb906);
          color: #000000;
          padding: 14px 16px;
          border: none;
          border-radius: 18px;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          box-shadow: 0 20px 40px rgba(255, 107, 53, 0.18);
          transition: transform 0.15s ease, filter 0.15s ease;
        }

        .new-chat-btn:hover {
          transform: translateY(-1px);
          filter: brightness(1.03);
        }

        .sidebar-section {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 22px;
          padding: 16px;
        }

        .sidebar-section-title {
          color: #f8f8f8;
          font-size: 12px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          margin-bottom: 12px;
        }

        .sidebar-prompts {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .sidebar-prompt {
          width: 100%;
          background: #130a13;
          color: #fff;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 16px;
          padding: 12px 14px;
          text-align: left;
          cursor: pointer;
          font-size: 13px;
          transition: transform 0.15s ease, background 0.15s ease;
        }

        .sidebar-prompt:hover {
          transform: translateX(3px);
          background: rgba(255, 255, 255, 0.04);
        }

        .sidebar-note {
          color: #b8b8b8;
          font-size: 13px;
          line-height: 1.6;
        }

        .chat-panel {
          display: flex;
          flex-direction: column;
          height: calc(100dvh - 28px);
          overflow: visible;
          background: #09040c;
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 28px;
          box-shadow: 0 30px 90px rgba(0, 0, 0, 0.35);
        }

        .header {
          padding: 22px 24px 18px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 0.5px solid rgba(255, 255, 255, 0.05);
          flex-shrink: 0;
          background: transparent;
        }

        .header-brand { display: flex; align-items: center; gap: 10px; }

        .yamu-logo {
          width: 38px; height: 38px; border-radius: 50%;
          background: linear-gradient(135deg, #ff6b35, #ff9500);
          display: flex; align-items: center; justify-content: center;
          font-size: 18px; font-weight: 700; color: #fff;
          font-family: 'DM Serif Display', serif;
        }
        .yamu-logo img {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          object-fit: cover;
        }

        .brand-name {
          color: #fff;
          font-size: 17px;
          font-weight: 500;
          font-family: 'DM Serif Display', serif;
          letter-spacing: 0.01em;
        }

        .brand-sub {
          font-size: 11px;
          color: #555;
          display: flex;
          align-items: center;
          gap: 5px;
          margin-top: 1px;
        }

        .online-dot {
          width: 6px; height: 6px;
          background: #4ade80;
          border-radius: 50%;
          display: inline-block;
        }

        .lang-badge {
          font-size: 11px;
          color: #565656;
          border: 0.5px solid #2a2a2a;
          padding: 4px 8px;
          border-radius: 20px;
          letter-spacing: 0.05em;
        }

        .chat-area {
          flex: 1;
          overflow-y: auto;
          scrollbar-width: thin;
          scrollbar-color: #302f2f transparent;
        }
        .chat-area::-webkit-scrollbar { width: 4px; }
        .chat-area::-webkit-scrollbar-track { background: transparent; }
        .chat-area::-webkit-scrollbar-thumb { background: #2a2a2a; border-radius: 4px; }

        .messages-inner {
          padding: 16px 16px 8px;
          display: flex;
          flex-direction: column;
          gap: 14px;
          min-height: 0;
          flex: 1 1 auto;
          overflow-y: auto;
        }

        .quick-replies {
          display: flex;
          gap: 8px;
          padding: 0 16px 10px;
          overflow-x: auto;
          scrollbar-width: none;
          flex-shrink: 0;
        }
        .quick-replies::-webkit-scrollbar { display: none; }

        .quick-reply-btn {
          flex-shrink: 0;
          background: #161616;
          border: 0.5px solid #2a2a2a;
          color: #aaa;
          font-size: 12px;
          font-family: 'DM Sans', sans-serif;
          padding: 7px 14px;
          border-radius: 20px;
          cursor: pointer;
          white-space: nowrap;
          transition: border-color 0.15s, color 0.15s;
        }
        .quick-reply-btn:hover { border-color: #ff6b3560; color: #ff9500; }

        .cart-area { padding: 0 14px; flex-shrink: 0; }

        .input-area {
          padding: 10px 14px 16px;
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
          border-top: 0.5px solid #1a1a1a;
        }

        .chat-input {
          flex: 1;
          background: #161616;
          border: 0.5px solid #2a2a2a;
          border-radius: 24px;
          padding: 10px 18px;
          color: #e8e8e8;
          font-size: 13.5px;
          font-family: 'DM Sans', sans-serif;
          outline: none;
          transition: border-color 0.2s;
        }
        .chat-input::placeholder { color: #3a3a3a; }
        .chat-input:focus { border-color: #ff6b3540; }
        .chat-input:disabled { opacity: 0.5; }

        .send-btn {
          width: 38px; height: 38px;
          border-radius: 50%;
          background: #ff6b35;
          border: none;
          cursor: pointer;
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: background 0.15s, transform 0.1s;
        }
        .send-btn:hover:not(:disabled) { background: #e85c28; }
        .send-btn:active:not(:disabled) { transform: scale(0.93); }
        .send-btn:disabled { background: #2a2a2a; color: #555; cursor: not-allowed; }
      `}</style>
    </div>
  );
}
