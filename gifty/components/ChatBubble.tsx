"use client";

import { motion } from "framer-motion";
import { ProductCarousel } from "./ProductCard";
import { OrderConfirmation } from "./OrderConfirmation";
import type { ChatMessage, Product } from "@/types";
import { useSessionStore } from "@/lib/session";

interface ChatBubbleProps {
  message: ChatMessage;
  isLatest?: boolean;
}

export function ChatBubble({ message }: ChatBubbleProps) {
  const addToCart = useSessionStore((s) => s.addToCart);
  const isAgent = message.role === "assistant";
  const clientTime = formatTime(message.timestamp);

  const handleAddToCart = (product: Product) => {
    addToCart(product);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className={`msg-row ${isAgent ? "agent-row" : "user-row"}`}
    >
      {isAgent && (
        <div className="agent-avatar">G</div>
      )}

      <div className={`msg-content ${isAgent ? "agent-content" : "user-content"}`}>
        {message.imagePreview && (
          <img
            src={message.imagePreview}
            alt="Uploaded product"
            className="msg-image"
          />
        )}

        {message.content && (
          <div className={`bubble ${isAgent ? "agent-bubble" : "user-bubble"}`}>
            <MessageText text={message.content} />
          </div>
        )}

        {isAgent && message.products && message.products.length > 0 && (
          <ProductCarousel products={message.products} onAdd={handleAddToCart} />
        )}

        {isAgent && message.order && (
          <OrderConfirmation order={message.order} />
        )}

        {clientTime ? (
          <span className="msg-time">
            {clientTime}
          </span>
        ) : null}
      </div>

      <style>{`
        .msg-row {
          display: flex;
          gap: 8px;
          align-items: flex-end;
          max-width: 100%;
        }
        .agent-row { flex-direction: row; }
        .user-row { flex-direction: row-reverse; }

        .agent-avatar {
          width: 26px;
          height: 26px;
          border-radius: 50%;
          background: linear-gradient(135deg, #ff6b35, #ff9500);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          font-weight: 500;
          color: #ffffff;
          font-family: 'DM Sans', sans-serif;
          flex-shrink: 0;
          margin-bottom: 16px;
        }

        .msg-content {
          display: flex;
          flex-direction: column;
          gap: 2px;
          max-width: calc(100% - 40px);
        }
        .agent-content { align-items: flex-start; }
        .user-content { align-items: flex-end; }

        .bubble {
          padding: 10px 14px;
          border-radius: 18px;
          font-size: 13.5px;
          line-height: 1.55;
          font-family: 'DM Sans', sans-serif;
          word-break: break-word;
        }
        .msg-image {
          width: min(220px, 64vw);
          max-height: 220px;
          object-fit: cover;
          border-radius: 16px 4px 16px 16px;
          border: 1px solid rgba(255, 255, 255, 0.18);
          box-shadow: 0 10px 24px rgba(0, 0, 0, 0.16);
        }
        .agent-bubble {
          background: #1a1a1a;
          color: #e8e8e8;
          border-radius: 4px 18px 18px 18px;
          border: 0.5px solid #2a2a2a;
          max-width: 280px;
        }
        .user-bubble {
          background: #ff6b35;
          color: #fff;
          border-radius: 18px 4px 18px 18px;
          max-width: 240px;
        }

        .msg-time {
          font-size: 10px;
          color: #444;
          padding: 0 4px;
          font-family: 'DM Sans', sans-serif;
        }
      `}</style>
    </motion.div>
  );
}

function MessageText({ text }: { text: string }) {
  // Render newlines and basic markdown-ish bold
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <strong key={i} style={{ fontWeight: 600 }}>
              {part.slice(2, -2)}
            </strong>
          );
        }
        return part.split("\n").map((line, j, arr) => (
          <span key={`${i}-${j}`}>
            {line}
            {j < arr.length - 1 && <br />}
          </span>
        ));
      })}
    </>
  );
}

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat("en-LK", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(date));
}

export function TypingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      className="typing-row"
    >
      <div className="typing-avatar">G</div>
      <div className="typing-bubble">
        <span className="dot" style={{ animationDelay: "0ms" }} />
        <span className="dot" style={{ animationDelay: "200ms" }} />
        <span className="dot" style={{ animationDelay: "400ms" }} />
      </div>
      <style>{`
        .typing-row {
          display: flex;
          gap: 8px;
          align-items: flex-end;
        }
        .typing-avatar {
          width: 28px; height: 28px; border-radius: 50%;
          background: linear-gradient(135deg, #ff6b35, #ff9500);
          display: flex; align-items: center; justify-content: center;
          font-size: 13px; font-weight: 700; color: #fff;
          font-family: 'DM Serif Display', serif;
          flex-shrink: 0;
        }
        .typing-bubble {
          background: #1a1a1a;
          border: 0.5px solid #2a2a2a;
          border-radius: 4px 18px 18px 18px;
          padding: 12px 16px;
          display: flex; gap: 5px; align-items: center;
        }
        .dot {
          width: 6px; height: 6px;
          background: #555; border-radius: 50%;
          display: inline-block;
          animation: typingDot 1.2s infinite ease-in-out;
        }
        @keyframes typingDot {
          0%, 60%, 100% { transform: scale(1); background: #555; }
          30% { transform: scale(1.4); background: #ff9500; }
        }
      `}</style>
    </motion.div>
  );
}
