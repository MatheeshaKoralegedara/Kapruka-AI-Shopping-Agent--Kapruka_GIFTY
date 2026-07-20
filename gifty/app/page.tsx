"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { AnimatePresence } from "framer-motion";
import { ChatBubble, TypingIndicator } from "@/components/ChatBubble";
import { CartPill } from "@/components/CartPill";
import { CartDetails } from "@/components/CartDetails";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useSessionStore } from "@/lib/session";
import type { ChatMessage } from "@/types";
import { ChatHistoryPanel } from "@/components/ChatHistory";
import { VoiceInputButton } from "@/components/VoiceInput";
import { useTextToSpeech } from "@/hooks/Usetexttospeach";
import { computeCartSignature } from "@/lib/Ordersignature";
import type { Order } from "@/types";



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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [lang] = useState<"en" | "si" | "ta" | "tanglish">("en");
  const sessionStore = useSessionStore();
  const resetSession = useSessionStore((s) => s.resetSession);
  const { isSupported: ttsSupported, speakingId, speak, stop: stopSpeaking, autoSpeak, setAutoSpeak } =
    useTextToSpeech();
  // Tracks the most recent order + a fingerprint of the cart/delivery state
  // it was created for. Sent with every request so the server can tell
  // whether an order already exists for the CURRENT cart, and avoid ever
  // calling createOrder() twice for the same thing (e.g. if the user asks
  // "give me order details" after checkout is already done).
  const lastOrderRef = useRef<{ order: Order; signature: string } | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  useEffect(() => {
    if (!autoSpeak || isLoading) return;
    const last = messages[messages.length - 1];
    if (last && last.role === "assistant" && last.id !== "welcome") {
      speak(last.id, last.content, last.language || "en");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, isLoading, autoSpeak]);

  // Lock body scroll while the mobile sidebar drawer is open
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [sidebarOpen]);

  // Close the drawer automatically if the viewport grows past the mobile breakpoint
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1025px)");
    const handle = (e: MediaQueryListEvent) => {
      if (e.matches) setSidebarOpen(false);
    };
    mq.addEventListener("change", handle);
    return () => mq.removeEventListener("change", handle);
  }, []);

  const autoPopulateSession = useCallback(
    (userText: string, agentText: string) => {
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

      const phoneMatch = userText.match(/0[17]\d{8}/);
      if (phoneMatch) sessionStore.setRecipientPhone(phoneMatch[0]);

      if (/morning|before 12|am\b/i.test(userText)) sessionStore.setDeliveryTime("morning");
      if (/evening|afternoon|after 12|pm\b/i.test(userText)) sessionStore.setDeliveryTime("afternoon");
    },
    [sessionStore]
  );

  const sendMessage = useCallback(
    async (
      text?: string,
      imageData?: { base64: string; mimeType: string; preview: string }
    ) => {
      const content = (text || input || (imageData ? "Find products like this image" : "")).trim();
      if ((!content && !imageData) || isLoading) return;

      setInput("");

      const userMsg: ChatMessage = {
        id: Date.now().toString(),
        role: "user",
        content,
        imagePreview: imageData?.preview,
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
            imageData: imageData
              ? { base64: imageData.base64, mimeType: imageData.mimeType }
              : undefined,
            existingOrder: lastOrderRef.current?.order,
            existingOrderSignature: lastOrderRef.current?.signature,
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
  tracking: data.tracking,
  timestamp: new Date(),
  language: data.language,
};

        if (data.order) {
          lastOrderRef.current = {
            order: data.order,
            signature: computeCartSignature({
              cart: sessionStore.toSessionData().cart,
              address: sessionStore.toSessionData().address,
              recipientName: sessionStore.toSessionData().recipientName,
              recipientPhone: sessionStore.toSessionData().recipientPhone,
              deliveryDate: sessionStore.toSessionData().deliveryDate,
            }),
          };
        }

        setMessages((prev) => [...prev, assistantMsg]);
      } catch (err) {
        console.error("sendMessage failed:", err);
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
    [autoPopulateSession, input, isLoading, messages, sessionStore]
  );

  const handleImageUpload = useCallback(
    (file: File) => {
      if (!file.type.startsWith("image/")) return;

      const reader = new FileReader();
      reader.onload = () => {
        const preview = String(reader.result || "");
        const base64 = preview.split(",")[1];
        if (!base64) return;
        sendMessage(input, {
          base64,
          mimeType: file.type,
          preview,
        });
      };
      reader.readAsDataURL(file);
    },
    [input, sendMessage]
  );

  const handleCheckout = useCallback(() => {
    const msg = "I'd like to checkout my cart";
    setInput(msg);
    setTimeout(() => sendMessage(msg), 100);
  }, [sendMessage]);

  const handleNewChat = useCallback(() => {
    stopSpeaking();
    resetSession();
    lastOrderRef.current = null;
    setMessages([WELCOME_MESSAGE]);
    setInput("");
    setShowCartDetails(false);
    setSidebarOpen(false);
    inputRef.current?.focus();
  }, [resetSession, stopSpeaking]);

  const handleOpenHistory = useCallback(() => {
    setHistoryOpen(true);
    setSidebarOpen(false);
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleVoiceTranscript = useCallback((text: string) =>
  {
    setInput((prev) => (prev ? prev + " " + text : text));
    setTimeout(() => sendMessage(text), 600);

  },[sendMessage]);

  // Used by sidebar prompt buttons: sends the message AND closes the mobile drawer
  const handleSidebarPrompt = useCallback(
    (qr: string) => {
      setSidebarOpen(false);
      sendMessage(qr);
    },
    [sendMessage]
  );

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
        <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
          <button
            type="button"
            className="sidebar-close"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close menu"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>

          <div className="sidebar-brand">
            <div className="sidebar-logo">
              <img src="/logo2.png" alt="GIFTY" width="30" height="30" />
            </div>
            <div>
              <div className="sidebar-tag">Kapruka chat shopping</div>
            </div>
          </div>

          <button type="button" className="new-chat-btn" onClick={handleNewChat}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Conversation
          </button>

          <button type="button" className="sidebar-prompt sidebar-history-btn" onClick={handleOpenHistory}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <polyline points="12 7 12 12 16 14" />
            </svg>
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
                  onClick={() => handleSidebarPrompt(qr)}
                >
                  {qr}
                </button>
              ))}
            </div>
          </div>

          <div className="sidebar-section sidebar-section-note">
            <div className="sidebar-section-title">Why GIFTY?</div>
            <p className="sidebar-note">
              Discover gifts fast, shop with Sinhala, English, Tamil, Tanglish support, and complete checkout in chat.
            </p>
          </div>
        </aside>

        {sidebarOpen && (
          <div
            className="sidebar-backdrop"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
        )}

        <section className="chat-panel">
          <header className="header">
            <div className="header-brand">
              <button
                type="button"
                className="menu-btn"
                onClick={() => setSidebarOpen(true)}
                aria-label="Open menu"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              </button>
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
              {ttsSupported && (
                <button
                  type="button"
                  className={`autospeak-btn ${autoSpeak ? "autospeak-btn-on" : ""}`}
                  onClick={() => {
                    if (autoSpeak) stopSpeaking();
                    setAutoSpeak((v) => !v);
                  }}
                  aria-pressed={autoSpeak}
                  aria-label={autoSpeak ? "Turn off voice replies" : "Turn on voice replies"}
                  title={autoSpeak ? "Voice replies on" : "Voice replies off"}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                    <path d="M11 5 6 9H2v6h4l5 4V5Z" />
                    {autoSpeak && <path d="M16 8a5 5 0 0 1 0 8" />}
                    {!autoSpeak && <path d="M23 9 17 15M17 9l6 6" opacity="0.6" />}
                  </svg>
                </button>
              )}
              <ThemeToggle />
            </div>
          </header>

          <main className="chat-area" role="log" aria-label="Chat messages" aria-live="polite">
            {messages.length === 1 && !isLoading ? (
              <div className="hero">
                <div className="hero-card">
                  <div className="hero-icon" aria-hidden="true">
                    <div className="hero-icon-img">
                      <img src="/logo1.png" alt="GIFTY" width="150" height="50" />
                    </div>
                  </div>
                  <h1 className="hero-title">How can I help you shop today?</h1>
                  <p className="hero-description">
                    I&apos;m GIFTY, your personal Kapruka shopping assistant. Ask me to find gifts, check prices, or browse categories.
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

                  {/* Compact horizontal chip row — only visible on small screens,
                      where the 2-col hero-prompts grid above is hidden. Keeps
                      starter prompts one tap away without opening the drawer. */}
                  <div className="hero-prompts-mobile" role="group" aria-label="Quick reply suggestions">
                    {quickReplies.map((qr) => (
                      <button
                        key={qr}
                        type="button"
                        className="hero-prompt-chip"
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
                <div className="messages-scroll-area">
                  {messages.map((msg, i) => (
                    <ChatBubble
                      key={msg.id || `message-${i}`}
                      message={msg}
                      isLatest={i === messages.length - 1}
                      onSpeak={ttsSupported ? (id, text, lang) => speak(id, text, lang) : undefined}
                      isSpeaking={speakingId === msg.id}
                      ttsSupported={ttsSupported}
                    />
                  ))}

                  <AnimatePresence>
                    {isLoading && <TypingIndicator />}
                  </AnimatePresence>

                  <div ref={bottomRef} />
                </div>
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
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="image-input"
              aria-label="Upload product image"
              disabled={isLoading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImageUpload(file);
                e.currentTarget.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="image-btn"
              disabled={isLoading}
              aria-label="Upload product image"
              title="Upload product image"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <circle cx="8.5" cy="10.5" r="1.5" />
                <path d="M21 15l-5-5L5 19" />
              </svg>
            </button>
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
            {input.trim() ? (
              <button
                onClick={() => sendMessage()}
                className="send-btn"
                disabled={isLoading}
                aria-label="Send message"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="12" y1="19" x2="12" y2="5" />
                  <polyline points="5 12 12 5 19 12" />
                </svg>
              </button>
            ) : (
              <VoiceInputButton
                onTranscript={handleVoiceTranscript}
                disabled={isLoading}
                language={lang}
              />
            )}
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
          --radius-lg: 30px;
          --radius-md: 20px;
          --radius-sm: 14px;
          --safe-top: env(safe-area-inset-top, 0px);
          --safe-bottom: env(safe-area-inset-bottom, 0px);
          --safe-left: env(safe-area-inset-left, 0px);
          --safe-right: env(safe-area-inset-right, 0px);
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

        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: 0.001ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.001ms !important;
            scroll-behavior: auto !important;
          }
        }

        .shell {
          min-height: 100vh;
          min-height: 100dvh;
          display: flex;
          align-items: stretch;
          justify-content: center;
          background: var(--color-bg-primary);
          font-family: 'DM Sans', sans-serif;
          padding: 16px;
          padding-top: max(16px, var(--safe-top));
          padding-bottom: max(16px, var(--safe-bottom));
          padding-left: max(16px, var(--safe-left));
          padding-right: max(16px, var(--safe-right));
          transition: background-color 0.3s ease;
        }

        html.dark .shell {
          background: radial-gradient(circle at top, rgba(255, 107, 53, 0.08), transparent 30%), var(--color-bg-primary);
        }

        .layout-grid {
          width: 100%;
          max-width: 1400px;
          display: grid;
          grid-template-columns: minmax(250px, 300px) minmax(0, 1fr);
          gap: 20px;
          align-items: stretch;
        }

        /* ---------- Sidebar ---------- */

        .sidebar {
          display: flex;
          flex-direction: column;
          gap: 22px;
          background: var(--color-bg-secondary);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          padding: 24px;
          min-height: calc(100dvh - 32px);
          position: sticky;
          top: 16px;
          transition: background-color 0.3s ease, border-color 0.3s ease, transform 0.28s ease;
        }

        .sidebar-brand {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .sidebar-logo {
          width: 84px;
          height: 40px;
          border-radius: 14px;
          background: linear-gradient(135deg, #ff6b35, #ff9500);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          font-weight: 700;
          font-size: 18px;
          flex-shrink: 0;
        }
        .sidebar-logo img {
          width: 84px;
          height: 40px;
          border-radius: 12px;
          object-fit: cover;
        }

        .sidebar-tag {
          color: var(--color-text-secondary);
          font-size: 12px;
          line-height: 1.5;
          transition: color 0.3s ease;
        }

        .sidebar-close {
          display: none;
          align-self: flex-end;
          width: 30px;
          height: 30px;
          border-radius: 50%;
          border: 0.5px solid var(--color-border);
          background: var(--color-bg-tertiary);
          color: var(--color-text-primary);
          align-items: center;
          justify-content: center;
          cursor: pointer;
          flex-shrink: 0;
          margin-bottom: -10px;
          transition: background 0.15s ease;
        }
        .sidebar-close:hover { background: var(--color-border); }

        .new-chat-btn {
          background: #fff;
          color: #0a050f;
          padding: 13px 16px;
          border: none;
          border-radius: 16px;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          box-shadow: 0 16px 32px rgba(208, 53, 255, 0.16);
          transition: transform 0.15s ease, filter 0.15s ease;
        }

        .new-chat-btn:hover {
          transform: translateY(-1px);
          filter: brightness(1.03);
        }
        .new-chat-btn:active { transform: translateY(0); }

        .sidebar-section {
          background: var(--color-bg-tertiary);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          padding: 15px;
          transition: background-color 0.3s ease, border-color 0.3s ease;
        }

        html.dark .sidebar-section {
          background: rgba(255, 255, 255, 0.02);
        }

        .sidebar-section-note {
          margin-top: auto;
        }

        .sidebar-section-title {
          color: var(--color-text-primary);
          font-size: 11px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          margin-bottom: 11px;
          font-weight: 600;
          transition: color 0.3s ease;
        }

        .sidebar-prompts {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .sidebar-prompt {
          width: 100%;
          background: var(--color-bg-primary);
          color: var(--color-text-primary);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-sm);
          padding: 11px 13px;
          text-align: left;
          cursor: pointer;
          font-size: 13px;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: transform 0.15s ease, background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
        }

        .sidebar-prompt:hover {
          transform: translateX(3px);
          background: var(--color-bg-tertiary);
          border-color: rgba(255, 107, 53, 0.33);
        }

        .sidebar-history-btn {
          color: var(--color-text-secondary);
          font-weight: 600;
        }

        .sidebar-note {
          color: var(--color-text-secondary);
          font-size: 12.5px;
          line-height: 1.6;
          transition: color 0.3s ease;
        }

        .sidebar-backdrop {
          display: none;
        }

        /* ---------- Chat panel ---------- */

        .chat-panel {
          display: flex;
          flex-direction: column;
          height: calc(100dvh - 32px);
          overflow: hidden;
          background: var(--color-bg-secondary);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          box-shadow: 0 30px 70px rgba(0, 0, 0, 0.14);
          transition: background-color 0.3s ease, border-color 0.3s ease;
        }

        html.light .chat-panel {
          box-shadow: 0 30px 70px rgba(0, 0, 0, 0.1);
        }

        .header {
          padding: 18px 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 0.5px solid var(--color-border);
          flex-shrink: 0;
          background: transparent;
          transition: border-color 0.3s ease;
        }

        .header-brand { display: flex; align-items: center; gap: 12px; min-width: 0; }
        .header-right { display: flex; align-items: center; gap: 12px; flex-shrink: 0; }

        .menu-btn {
          display: none;
          width: 36px;
          height: 36px;
          border-radius: 10px;
          background: var(--color-bg-tertiary);
          border: 0.5px solid var(--color-border);
          color: var(--color-text-primary);
          align-items: center;
          justify-content: center;
          cursor: pointer;
          flex-shrink: 0;
          transition: border-color 0.15s ease, color 0.15s ease;
        }
        .menu-btn:hover { border-color: #ff6b3560; color: #ff6b35; }
        .menu-btn:active { transform: scale(0.94); }

        .autospeak-btn {
          width: 34px;
          height: 34px;
          border-radius: 50%;
          background: var(--color-bg-tertiary);
          border: 0.5px solid var(--color-border);
          color: var(--color-text-secondary);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          flex-shrink: 0;
          transition: border-color 0.15s ease, color 0.15s ease, background 0.15s ease;
        }
        .autospeak-btn:hover { border-color: #ff6b3560; color: #ff6b35; }
        .autospeak-btn-on {
          background: #ff6b35;
          border-color: #ff6b35;
          color: #fff;
        }

        .brand-name {
          color: var(--color-text-primary);
          font-size: 16px;
          font-weight: 600;
          font-family: 'DM Sans', sans-serif;
          letter-spacing: 0.01em;
          line-height: 1.2;
          transition: color 0.3s ease;
        }

        .brand-sub {
          font-size: 11px;
          color: var(--color-text-secondary);
          display: flex;
          align-items: center;
          gap: 5px;
          margin-top: 2px;
          transition: color 0.3s ease;
        }

        .online-dot {
          width: 6px; height: 6px;
          background: #4ade80;
          border-radius: 50%;
          display: inline-block;
          flex-shrink: 0;
        }

        .lang-badge {
          font-size: 11px;
          color: var(--color-text-secondary);
          border: 0.5px solid var(--color-border);
          padding: 5px 10px;
          border-radius: 20px;
          letter-spacing: 0.05em;
          white-space: nowrap;
          transition: color 0.3s ease, border-color 0.3s ease;
        }

        .chat-area {
          flex: 1;
          overflow: hidden;
          display: flex;
          min-height: 0;
          transition: background-color 0.3s ease;
        }

        /* ---------- Hero (empty state) ---------- */

        .hero {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 32px 24px;
          overflow-y: auto;
        }

        .hero-card {
          width: min(100%, 760px);
          background: rgba(255, 255, 255, 0.9);
          border: 1px solid rgba(0, 0, 0, 0.08);
          border-radius: 32px;
          padding: 40px 40px 32px;
          text-align: center;
          box-shadow: 0 30px 80px rgba(7, 12, 34, 0.14);
          backdrop-filter: blur(16px);
          display: flex;
          flex-direction: column;
          gap: 22px;
        }

        html.dark .hero-card {
          background: rgba(15, 14, 25, 0.88);
          border-color: rgba(255, 255, 255, 0.08);
          box-shadow: 0 30px 80px rgba(0, 0, 0, 0.5);
        }

        .hero-icon-img {
          width: 140px;
          height: 46px;
          margin: 0 auto;
          display: grid;
          place-items: center;
        }

        .hero-icon-img img {
          border-radius: 20px;
        }

        .hero-title {
          font-size: clamp(1.7rem, 2.6vw, 2.6rem);
          line-height: 1.12;
          color: var(--color-text-primary);
          font-weight: 700;
          margin: 0;
        }

        .hero-description {
          max-width: 620px;
          margin: 0 auto;
          color: var(--color-text-secondary);
          font-size: 0.98rem;
          line-height: 1.7;
        }

        .hero-prompts {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
          margin-top: 2px;
        }

        .hero-prompt {
          border: 1px solid rgba(255, 107, 53, 0.2);
          background: rgba(255, 255, 255, 0.9);
          color: #111827;
          padding: 16px 18px;
          border-radius: 18px;
          font-size: 0.92rem;
          font-weight: 600;
          cursor: pointer;
          transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
        }

        .hero-prompt:hover {
          transform: translateY(-2px);
          border-color: #ff6b35;
          box-shadow: 0 12px 28px rgba(255, 107, 53, 0.12);
        }
        .hero-prompt:active { transform: translateY(0); }

        html.dark .hero-prompt {
          background: rgba(255, 255, 255, 0.05);
          color: #f8fafc;
        }

        .hero-prompts-mobile {
          display: none;
        }

        /* ---------- Messages ---------- */

        .messages-inner {
          flex: 1 1 auto;
          min-height: 0;
          display: flex;
          justify-content: center;
          overflow-y: auto;
          scrollbar-width: thin;
          scrollbar-color: var(--color-border) transparent;
        }
        .messages-inner::-webkit-scrollbar { width: 5px; }
        .messages-inner::-webkit-scrollbar-track { background: transparent; }
        .messages-inner::-webkit-scrollbar-thumb { background: var(--color-bg-tertiary); border-radius: 4px; }

        .messages-scroll-area {
          width: 100%;
          max-width: 820px;
          padding: 20px 24px 12px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        /* ---------- Quick replies / cart / input ---------- */

        .quick-replies {
          display: flex;
          gap: 8px;
          padding: 0 20px 10px;
          overflow-x: auto;
          scrollbar-width: none;
          flex-shrink: 0;
          justify-content: center;
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

        .cart-area {
          padding: 0 20px;
          flex-shrink: 0;
          display: flex;
          justify-content: center;
        }
        .cart-area > * { width: 100%; max-width: 820px; }

        .input-area {
          padding: 14px 20px 18px;
          display: flex;
          align-items: center;
          gap: 10px;
          flex-shrink: 0;
          border-top: 0.5px solid var(--color-border);
          background: var(--color-bg-secondary);
          position: sticky;
          bottom: 0;
          z-index: 2;
          justify-content: center;
          transition: border-color 0.3s ease;
        }

        .input-area > * { flex-shrink: 0; }
        .input-area .chat-input { flex: 1; max-width: 780px; }

        .image-input {
          display: none;
        }

        .image-btn {
          width: 40px; height: 40px;
          border-radius: 50%;
          background: var(--color-bg-tertiary);
          border: 0.5px solid var(--color-border);
          cursor: pointer;
          color: var(--color-text-primary);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: border-color 0.15s, transform 0.1s, color 0.15s;
        }
        .image-btn:hover:not(:disabled) { border-color: #ff6b3560; color: #ff6b35; }
        .image-btn:active:not(:disabled) { transform: scale(0.93); }
        .image-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        .chat-input {
          background: var(--color-bg-tertiary);
          border: 0.5px solid var(--color-border);
          border-radius: 24px;
          padding: 11px 18px;
          color: var(--color-text-primary);
          font-size: 14px;
          font-family: 'DM Sans', sans-serif;
          outline: none;
          transition: border-color 0.2s, background-color 0.3s, color 0.3s;
        }
        .chat-input::placeholder { color: var(--color-text-secondary); opacity: 0.55; }
        .chat-input:focus { border-color: #ff6b3540; }
        .chat-input:disabled { opacity: 0.5; }

        .send-btn {
          width: 40px; height: 40px;
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

        /* ---------- Focus visibility (accessibility) ---------- */

        button:focus-visible,
        input:focus-visible {
          outline: 2px solid #ff6b35;
          outline-offset: 2px;
        }

        /* ==================================================
           TABLET / SMALL DESKTOP
           ================================================== */
        @media (max-width: 1180px) {
          .layout-grid {
            grid-template-columns: minmax(230px, 270px) minmax(0, 1fr);
            gap: 16px;
          }
          .sidebar { padding: 20px; }
        }

        /* ==================================================
           MOBILE + TABLET (drawer sidebar)
           ================================================== */
        @media (max-width: 1024px) {
          body, html { overflow: visible; }
          .shell { padding: 12px; padding-top: max(12px, var(--safe-top)); padding-bottom: max(12px, var(--safe-bottom)); }
          .layout-grid { grid-template-columns: 1fr; gap: 0; }

          .menu-btn {
            display: flex;
          }

          .sidebar {
            position: fixed;
            top: 0;
            left: 0;
            height: 100dvh;
            width: min(84vw, 320px);
            max-height: none;
            border-radius: 0 26px 26px 0;
            z-index: 60;
            transform: translateX(-105%);
            box-shadow: 0 0 60px rgba(0, 0, 0, 0.35);
            overflow-y: auto;
            padding-top: max(20px, var(--safe-top));
            padding-bottom: max(20px, var(--safe-bottom));
          }

          .sidebar.sidebar-open {
            transform: translateX(0);
          }

          .sidebar-close {
            display: flex;
          }

          .sidebar-backdrop {
            display: block;
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.5);
            z-index: 55;
            animation: fadeIn 0.2s ease;
          }

          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }

          .chat-panel {
            height: calc(100dvh - 24px);
          }

          .header {
            padding: 14px 16px;
          }
        }

        /* ==================================================
           SMALL MOBILE
           ================================================== */
        @media (max-width: 640px) {
          .shell {
            padding: 8px;
            padding-top: max(8px, var(--safe-top));
            padding-bottom: max(8px, var(--safe-bottom));
          }

          .chat-panel {
            height: calc(100dvh - 16px);
            border-radius: 22px;
          }

          .header {
            padding: 12px 14px;
          }
          .brand-name { font-size: 15px; }
          .brand-sub { font-size: 10px; }
          .header-right { gap: 8px; }
          .lang-badge { font-size: 9.5px; padding: 4px 8px; }

          .hero {
            padding: 16px 14px;
            align-items: flex-start;
            padding-top: 8vh;
          }
          .hero-card {
            padding: 26px 20px 24px;
            border-radius: 24px;
            gap: 16px;
          }
          .hero-icon-img { width: 120px; height: 40px; }
          .hero-title {
            font-size: 1.4rem;
          }
          .hero-description {
            font-size: 0.86rem;
            line-height: 1.6;
          }
          /* The 2-col grid is too wide for small screens; swap it for a
             horizontal-scroll chip row instead of hiding prompts entirely. */
          .hero-prompts {
            display: none;
          }
          .hero-prompts-mobile {
            display: flex;
            gap: 8px;
            overflow-x: auto;
            scrollbar-width: none;
            padding: 2px 2px 4px;
            margin: 0 -20px;
            padding-left: 20px;
            padding-right: 20px;
            justify-content: flex-start;
          }
          .hero-prompts-mobile::-webkit-scrollbar { display: none; }
          .hero-prompt-chip {
            flex-shrink: 0;
            border: 1px solid rgba(255, 107, 53, 0.25);
            background: var(--color-bg-tertiary);
            color: var(--color-text-primary);
            padding: 9px 14px;
            border-radius: 20px;
            font-size: 12.5px;
            font-weight: 600;
            white-space: nowrap;
            cursor: pointer;
            transition: border-color 0.15s ease, transform 0.1s ease;
          }
          .hero-prompt-chip:active {
            transform: scale(0.96);
            border-color: #ff6b35;
          }

          .messages-scroll-area {
            padding: 14px 14px 8px;
            gap: 12px;
          }

          .quick-replies { padding: 0 12px 8px; justify-content: flex-start; }
          .cart-area { padding: 0 12px; }

          .input-area {
            padding: 10px 12px;
            padding-bottom: max(10px, var(--safe-bottom));
            gap: 8px;
          }
          .image-btn { width: 38px; height: 38px; }
          .chat-input {
            font-size: 16px; /* prevents iOS auto-zoom on focus */
            padding: 10px 16px;
          }
          .send-btn { width: 42px; height: 42px; }
        }

        /* Very small phones (≤380px) */
        @media (max-width: 380px) {
          .hero-title { font-size: 1.25rem; }
          .sidebar { width: 88vw; }
        }
      `}</style>
    </div>
  );
}