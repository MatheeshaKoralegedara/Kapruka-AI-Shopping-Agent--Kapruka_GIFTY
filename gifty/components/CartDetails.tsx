"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useSessionStore } from "@/lib/session";

export function CartDetails() {
  const cart = useSessionStore((s) => s.cart);
  const getTotal = useSessionStore((s) => s.getTotal);
  const removeFromCart = useSessionStore((s) => s.removeFromCart);
  const updateQuantity = useSessionStore((s) => s.updateQuantity);

  if (!cart.length) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 14 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="cart-details"
      >
        <div className="cart-details-header">
          <div>
            <div className="cart-details-title">Cart review</div>
            <div className="cart-details-sub">Tap item names to remove or adjust quantities.</div>
          </div>
          <div className="cart-details-total">Rs. {getTotal().toLocaleString()}</div>
        </div>

        <div className="cart-details-items">
          {cart.map((item) => (
            <div key={item.id} className="cart-item-row">
              <div>
                <div className="cart-item-name">{item.name}</div>
                <div className="cart-item-meta">
                  Rs. {item.price.toLocaleString()} × {item.quantity}
                </div>
              </div>
              <div className="cart-item-actions">
                <button
                  type="button"
                  className="cart-qty-btn"
                  onClick={() => updateQuantity(item.id, item.quantity - 1)}
                >
                  –
                </button>
                <span className="cart-qty">{item.quantity}</span>
                <button
                  type="button"
                  className="cart-qty-btn"
                  onClick={() => updateQuantity(item.id, item.quantity + 1)}
                >
                  +
                </button>
                <button
                  type="button"
                  className="cart-remove"
                  onClick={() => removeFromCart(item.id)}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>

        <style>{`
          .cart-details {
            background: rgba(255, 107, 53, 0.08);
            border: 1px solid rgba(255, 107, 53, 0.18);
            border-radius: 18px;
            padding: 14px 16px;
            margin-top: 10px;
            color: #f3f3f3;
          }
          .cart-details-header {
            display: flex;
            justify-content: space-between;
            gap: 12px;
            align-items: flex-start;
            margin-bottom: 12px;
          }
          .cart-details-title {
            font-size: 13px;
            font-weight: 700;
            color: #fff;
            margin-bottom: 2px;
          }
          .cart-details-sub {
            font-size: 11px;
            color: #c6c6c6;
          }
          .cart-details-total {
            font-size: 13px;
            font-weight: 700;
            color: #ffbe7a;
            white-space: nowrap;
          }
          .cart-details-items {
            display: flex;
            flex-direction: column;
            gap: 10px;
          }
          .cart-item-row {
            display: grid;
            grid-template-columns: 1fr auto;
            gap: 10px;
            align-items: center;
            padding: 10px 0;
            border-top: 1px solid rgba(255, 255, 255, 0.05);
          }
          .cart-item-row:first-child { border-top: none; }
          .cart-item-name {
            font-size: 12.5px;
            font-weight: 600;
            color: #f8f8f8;
            margin-bottom: 3px;
          }
          .cart-item-meta {
            font-size: 11px;
            color: #bcbcbc;
          }
          .cart-item-actions {
            display: flex;
            align-items: center;
            gap: 8px;
            flex-wrap: wrap;
            justify-content: flex-end;
          }
          .cart-qty-btn {
            background: rgba(255, 255, 255, 0.06);
            border: 1px solid rgba(255, 255, 255, 0.12);
            color: #fff;
            border-radius: 10px;
            width: 26px;
            height: 26px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
            cursor: pointer;
          }
          .cart-qty {
            min-width: 18px;
            text-align: center;
            font-size: 12px;
            color: #fff;
          }
          .cart-remove {
            background: transparent;
            border: none;
            color: #ff9a83;
            font-size: 11px;
            cursor: pointer;
          }
        `}</style>
      </motion.div>
    </AnimatePresence>
  );
}
