"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useSessionStore } from "@/lib/session";

interface CartPillProps {
  onCheckout: () => void;
  onReview: () => void;
}

export function CartPill({ onCheckout, onReview }: CartPillProps) {
  const cart = useSessionStore((s) => s.cart);
  const getTotal = useSessionStore((s) => s.getTotal);
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const total = getTotal();

  return (
    <AnimatePresence>
      {itemCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="cart-pill"
        >
          <div className="cart-left">
            <div className="cart-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <path d="M16 10a4 4 0 01-8 0" />
              </svg>
            </div>
            <div>
              <div className="cart-label">
                {itemCount} {itemCount === 1 ? "item" : "items"} in cart
              </div>
              <div className="cart-total">
                Rs. {total.toLocaleString()}
              </div>
            </div>
          </div>

          <div className="cart-actions">
            <button onClick={onReview} className="review-btn">
              View cart
            </button>
            <button onClick={onCheckout} className="checkout-btn">
              Checkout →
            </button>
          </div>

          <style>{`
            .cart-pill {
              margin: 0 0 8px;
              background: #161616;
              border: 0.5px solid #ff6b3540;
              border-radius: 18px;
              padding: 12px 14px;
              display: flex;
              align-items: center;
              justify-content: space-between;
              flex-wrap: wrap;
              gap: 10px;
              flex-shrink: 0;
            }
            .cart-left {
              display: flex;
              align-items: center;
              gap: 10px;
            }
            .cart-icon {
              width: 32px; height: 32px;
              border-radius: 10px;
              background: #ff6b3520;
              display: flex; align-items: center; justify-content: center;
              color: #ff6b35;
            }
            .cart-label {
              color: #aaa;
              font-size: 11px;
              font-family: 'DM Sans', sans-serif;
            }
            .cart-total {
              color: #fff;
              font-size: 14px;
              font-weight: 600;
              font-family: 'DM Sans', sans-serif;
            }
            .cart-actions {
              display: flex;
              gap: 8px;
              align-items: center;
            }
            .review-btn,
            .checkout-btn {
              background: transparent;
              border: 1px solid rgba(255, 255, 255, 0.16);
              color: #fff;
              padding: 8px 12px;
              border-radius: 12px;
              font-size: 11px;
              font-weight: 600;
              font-family: 'DM Sans', sans-serif;
              cursor: pointer;
              transition: background 0.15s, border-color 0.15s;
            }
            .review-btn:hover,
            .checkout-btn:hover {
              background: rgba(255, 107, 53, 0.16);
              border-color: rgba(255, 107, 53, 0.4);
            }
            .checkout-btn {
              background: #ff6b35;
              border-color: transparent;
              color: #fff;
            }
            .checkout-btn:hover {
              background: #e85c28;
            }
            .checkout-btn:active {
              transform: scale(0.98);
            }
          `}</style>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

