"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { AnimatePresence } from "framer-motion";
import { ChatBubble, TypingIndicator } from "@/components/ChatBubble";
import { CartPill } from "@/components/CartPill";
import { CartDetails } from "@/components/CartDetails";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useSessionStore } from "@/lib/session";
import type { ChatMessage, Product } from "@/types";
import { ChatHistoryPanel } from "@/components/ChatHistory";

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
  const [historyOpen, setHistoryOpen] = useState(false);
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
          content: "Sorry, something went wrong ☹️ Try again?",
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

  const handleOpenHistory = useCallback(() => {
    setHistoryOpen(true);
  }, []);

  const handleCloseHistory = useCallback(() => {
    setHistoryOpen(false);
  }, []);

  const handleLoadSession = useCallback((sessionMessages: ChatMessage[]) => {
    setMessages(sessionMessages);
    setShowCartDetails(false);
    setInput("");
    setHistoryOpen(false);
  }, []);

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
    "அம்மாவுக்கு gift",
    "Romantic gift 💕",
    "Under Rs. 3000",
  ];

  return (
    <div className="shell">
      <div className="layout-grid">
        <aside className="sidebar">
          <div className="sidebar-brand">
            <div className="sidebar-logo">
              <img src="/logo2.png" alt="GIFTY" width="30" height="30" />
            </div>
            <div>
              
              <div className="sidebar-tag">Kapruka chat shopping</div>
            </div>
          </div>

          <button type="button" className="new-chat-btn" onClick={handleNewChat}>
            + New Conversation
          </button>

          <button type="button" className="sidebar-prompt" onClick={handleOpenHistory}>
            View chat history
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
              Discover gifts fast, shop with Sinhala, English, Tamil, Tanglish support, and complete checkout in chat.
            </p>
          </div>
        </aside>

        <section className="chat-panel">
          <header className="header">
            <div className="header-brand">
              
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
              <ThemeToggle />
            </div>
          </header>

          <main className="chat-area" role="log" aria-label="Chat messages" aria-live="polite">
            {messages.length === 1 && !isLoading ? (
              <div className="hero">
                <div className="hero-card">
                  <div className="hero-icon" aria-hidden="true">
                    <div className="hero-icon-img">
                      <img src="/logo1.png" alt="GIFTY"  width="150" height="50" />
                    </div>
                  </div>
                  <h1 className="hero-title">How can I help you shop today?</h1>
                  <p className="hero-description">
                    I'm GIFTY, your personal Kapruka shopping assistant. Ask me to find gifts, check prices, or browse categories.
                  </p>

                  <div className="hero-prompts">
                    {quickReplies.map((qr) => (
                      <button
                        key={qr}
                        type="button"
                        className="hero-prompt"
                        onClick={() => sendMessage(qr)}
                      >
                        {qr}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="messages-inner">
                {messages.map((msg, i) => (
                  <ChatBubble
                    key={msg.id || `message-${i}`}
                    message={msg}
                    isLatest={i === messages.length - 1}
                  />
                ))}

                <AnimatePresence>
                  {isLoading && <TypingIndicator />}
                </AnimatePresence>

                <div ref={bottomRef} />
              </div>
            )}
          </main>

          {messages.length > 1 && !isLoading && (
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

      <ChatHistoryPanel
        currentMessages={messages}
        onLoadSession={handleLoadSession}
        onNewChat={handleNewChat}
        isOpen={historyOpen}
        onClose={handleCloseHistory}
      />

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,400&display=swap');

        :root {
          --color-bg-primary: #fff;
          --color-bg-secondary: #f5f5f5;
          --color-bg-tertiary: #f0f0f0;
          --color-text-primary: #000;
          --color-text-secondary: #555;
          --color-border: rgba(0, 0, 0, 0.1);
          --color-accent: #ff6b35;
        }

        html.dark {
          --color-bg-primary: #0a050f;
          --color-bg-secondary: #0e0813;
          --color-bg-tertiary: #161616;
          --color-text-primary: #fff;
          --color-text-secondary: #a3a3a3;
          --color-border: rgba(255, 255, 255, 0.06);
          --color-accent: #ff6b35;
        }

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        body, html { min-height: 100%; overflow: auto; }

        .shell {
          min-height: 100vh;
          display: flex;
          align-items: stretch;
          justify-content: center;
          background: var(--color-bg-primary);
          font-family: 'DM Sans', sans-serif;
          padding: 14px;
          transition: background-color 0.3s ease;
        }

        html.dark .shell {
          background: radial-gradient(circle at top, rgba(255, 107, 53, 0.08), transparent 30%), var(--color-bg-primary);
        }

        .layout-grid {
          width: 100%;
          max-width: 1360px;
          display: grid;
          grid-template-columns: minmax(260px, 320px) minmax(0, 1fr);
          gap: 24px;
          align-items: stretch;
        }

        .sidebar {
          display: flex;
          flex-direction: column;
          gap: 28px;
          background: var(--color-bg-secondary);
          border: 1px solid var(--color-border);
          border-radius: 30px;
          padding: 26px;
          min-height: calc(100dvh - 34px);
          position: sticky;
          top: 16px;
          transition: background-color 0.3s ease, border-color 0.3s ease;
        }

        .sidebar-brand {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .sidebar-logo {
          width: 90px;
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
          width: 90px;
          height: 44px;
          border-radius: 12px;
          object-fit: cover;
        }

        .sidebar-name {
          color: var(--color-text-primary);
          font-size: 18px;
          font-weight: 700;
          transition: color 0.3s ease;
        }

        .sidebar-tag {
          color: var(--color-text-secondary);
          font-size: 12px;
          line-height: 1.5;
          transition: color 0.3s ease;
        }

        .new-chat-btn {
          background: linear-gradient(135deg, #ffffff, #ffffff);
          color: #000000;
          padding: 14px 16px;
          border: none;
          border-radius: 18px;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          box-shadow: 0 20px 40px rgba(208, 53, 255, 0.18);
          transition: transform 0.15s ease, filter 0.15s ease;
        }

        html.dark .new-chat-btn {
          background: linear-gradient(135deg, #ffffff, #ffffff);
        }

        .new-chat-btn:hover {
          transform: translateY(-1px);
          filter: brightness(1.03);
        }

        .sidebar-section {
          background: var(--color-bg-tertiary);
          border: 1px solid var(--color-border);
          border-radius: 22px;
          padding: 16px;
          transition: background-color 0.3s ease, border-color 0.3s ease;
        }

        html.dark .sidebar-section {
          background: rgba(255, 255, 255, 0.02);
        }

        .sidebar-section-title {
          color: var(--color-text-primary);
          font-size: 12px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          margin-bottom: 12px;
          transition: color 0.3s ease;
        }

        .sidebar-prompts {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .sidebar-prompt {
          width: 100%;
          background: var(--color-bg-primary);
          color: var(--color-text-primary);
          border: 1px solid var(--color-border);
          border-radius: 16px;
          padding: 12px 14px;
          text-align: left;
          cursor: pointer;
          font-size: 13px;
          transition: transform 0.15s ease, background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
        }

        .sidebar-prompt:hover {
          transform: translateX(3px);
          background: var(--color-bg-tertiary);
          border-color: rgba(255, 107, 53, 0.33);
        }

        .sidebar-note {
          color: var(--color-text-secondary);
          font-size: 13px;
          line-height: 1.6;
          transition: color 0.3s ease;
        }

        .chat-panel {
          display: flex;
          flex-direction: column;
          height: calc(100dvh - 32px);
          overflow: hidden;
          background: var(--color-bg-secondary);
          border: 1px solid var(--color-border);
          border-radius: 30px;
          box-shadow: 0 34px 85px rgba(0, 0, 0, 0.14);
          transition: background-color 0.3s ease, border-color 0.3s ease;
        }

        html.light .chat-panel {
          box-shadow: 0 34px 85px rgba(0, 0, 0, 0.1);
        }

        .header {
          padding: 22px 24px 18px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 0.5px solid var(--color-border);
          flex-shrink: 0;
          background: transparent;
          transition: border-color 0.3s ease;
        }

        .header-brand { display: flex; align-items: center; gap: 10px; }
        .header-right { display: flex; align-items: center; gap: 12px; }

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
          color: var(--color-text-primary);
          font-size: 17px;
          font-weight: 500;
          font-family: 'DM Sans', sans-serif;
          letter-spacing: 0.01em;
          transition: color 0.3s ease;
        }

        .brand-sub {
          font-size: 11px;
          color: var(--color-text-secondary);
          display: flex;
          align-items: center;
          gap: 5px;
          margin-top: 1px;
          transition: color 0.3s ease;
        }

        .online-dot {
          width: 6px; height: 6px;
          background: #4ade80;
          border-radius: 50%;
          display: inline-block;
        }

        .lang-badge {
          font-size: 11px;
          color: var(--color-text-secondary);
          border: 0.5px solid var(--color-border);
          padding: 4px 8px;
          border-radius: 20px;
          letter-spacing: 0.05em;
          transition: color 0.3s ease, border-color 0.3s ease;
        }

        .chat-area {
          flex: 1;
          overflow: hidden;
          display: flex;
          min-height: 0;
          transition: background-color 0.3s ease;
        }
        .chat-area::-webkit-scrollbar { width: 4px; }
        .chat-area::-webkit-scrollbar-track { background: transparent; }
        .chat-area::-webkit-scrollbar-thumb { background: var(--color-bg-tertiary); border-radius: 4px; transition: background 0.3s ease; }

        .hero {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 34px 24px;
        }

        .hero-card {
          width: min(100%, 840px);
          background: rgba(255, 255, 255, 0.9);
          border: 1px solid rgba(0, 0, 0, 0.08);
          border-radius: 36px;
          padding: 44px 44px 34px;
          text-align: center;
          box-shadow: 0 35px 90px rgba(7, 12, 34, 0.16);
          backdrop-filter: blur(16px);
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        html.dark .hero-card {
          background: rgba(15, 14, 25, 0.88);
          border-color: rgba(255, 255, 255, 0.08);
          box-shadow: 0 35px 90px rgba(0, 0, 0, 0.5);
        }

        .hero-icon {
          width: 150px;
          height: 49px;
          margin: 0 auto;
          border-radius: 24px;
          display: grid;
          place-items: center;
          font-size: 32px;
          color: #ffffff;
          background: linear-gradient(135deg, #ff35eb, #2e0236);
          box-shadow: 0 10px 30px rgb(97, 5, 130);
        }
          
        .hero-icon-img {
          width: 150px;
          height: 50px;
          
          display: grid;
          place-items: center;
          object-fit: cover;
        }

        .hero-icon-img img {
          border-radius: 24px;
        }

        .hero-title {
          font-size: clamp(2rem, 3vw, 3rem);
          line-height: 1.05;
          color: var(--color-text-primary);
          font-weight: 700;
          margin: 0;
        }

        .hero-description {
          max-width: 680px;
          margin: 0 auto;
          color: var(--color-text-secondary);
          font-size: 1rem;
          line-height: 1.8;
        }

        .hero-prompts {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
          margin-top: 4px;
        }

        .hero-prompt {
          border: 1px solid rgba(255, 107, 53, 0.2);
          background: rgba(255, 255, 255, 0.9);
          color: #111827;
          padding: 18px 20px;
          border-radius: 20px;
          font-size: 0.96rem;
          font-weight: 600;
          cursor: pointer;
          transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
        }

        .hero-prompt:hover {
          transform: translateY(-2px);
          border-color: #ff6b35;
          box-shadow: 0 12px 28px rgba(255, 107, 53, 0.12);
        }

        html.dark .hero-prompt {
          background: rgba(255, 255, 255, 0.05);
          color: #f8fafc;
        }

        .messages-inner {
          padding: 18px 20px 10px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          min-height: 0;
          flex: 1 1 auto;
          overflow-y: auto;
          scrollbar-width: thin;
          scrollbar-color: var(--color-border) transparent;
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
          background: var(--color-bg-tertiary);
          border: 0.5px solid var(--color-border);
          color: var(--color-text-secondary);
          font-size: 12px;
          font-family: 'DM Sans', sans-serif;
          padding: 7px 14px;
          border-radius: 20px;
          cursor: pointer;
          white-space: nowrap;
          transition: border-color 0.15s, color 0.15s, background-color 0.15s;
        }
        .quick-reply-btn:hover { border-color: #ff6b3560; color: #ff9500; }

        .cart-area { padding: 0 14px; flex-shrink: 0; }

        .input-area {
          padding: 14px 16px 16px;
          display: flex;
          align-items: center;
          gap: 10px;
          flex-shrink: 0;
          border-top: 0.5px solid var(--color-border);
          background: var(--color-bg-secondary);
          position: sticky;
          bottom: 0;
          z-index: 2;
          transition: border-color 0.3s ease;
        }

        .chat-input {
          flex: 1;
          background: var(--color-bg-tertiary);
          border: 0.5px solid var(--color-border);
          border-radius: 24px;
          padding: 10px 18px;
          color: var(--color-text-primary);
          font-size: 13.5px;
          font-family: 'DM Sans', sans-serif;
          outline: none;
          transition: border-color 0.2s, background-color 0.3s, color 0.3s;
        }
        .chat-input::placeholder { color: var(--color-text-secondary); opacity: 0.5; }
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
        .send-btn:disabled { background: var(--color-bg-tertiary); color: var(--color-text-secondary); cursor: not-allowed; }

        @media (max-width: 1024px) {
          body, html { overflow: visible; }
          .shell { padding: 12px; }
          .layout-grid { grid-template-columns: 1fr; gap: 16px; }
          .sidebar {
            position: relative;
            top: 0;
            min-height: auto;
            max-height: none;
          }
          .chat-panel {
            height: auto;
            min-height: calc(100dvh - 32px);
          }
          .header { flex-wrap: wrap; gap: 12px; }
          .header-right { width: 100%; justify-content: space-between; }
        }

        @media (max-width: 640px) {
          .shell {
            padding: 10px;
          }
          .sidebar {
            padding: 18px;
            border-radius: 24px;
          }
          .new-chat-btn { width: 100%; }
          .header {
            padding: 18px 18px 14px;
            justify-content: space-between;
          }
          .brand-name { font-size: 16px; }
          .header-right { gap: 10px; }
          .lang-badge { font-size: 10px; padding: 4px 7px; }
          .chat-area { min-height: 50vh; }
          .input-area {
            padding: 10px 12px 14px;
            gap: 8px;
            flex-wrap: wrap;
          }
          .chat-input {
            width: 100%;
            min-width: 0;
          }
          .send-btn { width: 44px; height: 44px; }
          .quick-replies { padding: 0 12px 10px; }
          .sidebar-prompt { font-size: 12px; }
          .messages-inner { gap: 12px; }
        }
      `}</style>
    </div>
  );
}
