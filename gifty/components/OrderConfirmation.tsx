"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Order } from "@/types";

interface OrderConfirmationProps {
  order: Order;
}

export function OrderConfirmation({ order }: OrderConfirmationProps) {
  const [expanded, setExpanded] = useState(false);
  const hasDetails =
    (order.items && order.items.length > 0) ||
    order.deliveryAddress ||
    order.recipientName ||
    order.recipientPhone ||
    order.deliveryDate ||
    order.giftNote;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="order-card"
    >
      <div className="order-header">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <circle cx="8" cy="8" r="8" fill="#16a34a" />
          <path d="M4.5 8l2.5 2.5 4.5-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="order-success-label">Order confirmed!</span>
      </div>

      <div className="order-id">
        Order #{order.orderId}
      </div>

      <div className="order-total-row">
        <span className="order-total-label">Total</span>
        <span className="order-total-val">Rs. {order.total.toLocaleString()}</span>
      </div>

      {hasDetails && (
        <button
          type="button"
          className="details-toggle"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
        >
          {expanded ? "Hide order details" : "View order details"}
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`chevron ${expanded ? "chevron-up" : ""}`}
            aria-hidden="true"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      )}

      <AnimatePresence initial={false}>
        {expanded && hasDetails && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="details-panel"
          >
            {order.items && order.items.length > 0 && (
              <div className="details-section">
                <div className="details-section-title">Items</div>
                {order.items.map((item) => (
                  <div className="details-item-row" key={item.id}>
                    {item.image && (
                      <img src={item.image} alt={item.name} className="details-item-img" />
                    )}
                    <div className="details-item-info">
                      <span className="details-item-name">{item.name}</span>
                      <span className="details-item-meta">
                        Qty {item.quantity} · Rs. {item.price.toLocaleString()}
                      </span>
                    </div>
                    <span className="details-item-subtotal">
                      Rs. {(item.price * item.quantity).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {(order.recipientName || order.recipientPhone) && (
              <div className="details-section">
                <div className="details-section-title">Recipient</div>
                {order.recipientName && <div className="details-line">{order.recipientName}</div>}
                {order.recipientPhone && <div className="details-line">{order.recipientPhone}</div>}
              </div>
            )}

            {order.deliveryAddress && (
              <div className="details-section">
                <div className="details-section-title">Delivery address</div>
                <div className="details-line">{order.deliveryAddress}</div>
              </div>
            )}

            {order.deliveryDate && (
              <div className="details-section">
                <div className="details-section-title">Delivery date</div>
                <div className="details-line">{order.deliveryDate}</div>
              </div>
            )}

            {order.giftNote && (
              <div className="details-section">
                <div className="details-section-title">Gift note</div>
                <div className="details-line details-gift-note">&ldquo;{order.giftNote}&rdquo;</div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <a
        href={order.payLink}
        target="_blank"
        rel="noopener noreferrer"
        className="pay-btn"
      >
        Pay now →
      </a>

      <style>{`
        .order-card {
          background: #0f2a1a;
          border: 0.5px solid #1d5c35;
          border-radius: 14px;
          padding: 14px;
          max-width: 280px;
          font-family: 'DM Sans', sans-serif;
        }
        .order-header {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 8px;
        }
        .order-success-label {
          color: #4ade80;
          font-size: 13px;
          font-weight: 600;
        }
        .order-id {
          color: #6ee7b7;
          font-size: 11px;
          margin-bottom: 10px;
        }
        .order-total-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: #0a1f10;
          border-radius: 8px;
          padding: 8px 12px;
          margin-bottom: 10px;
        }
        .order-total-label {
          color: #6ee7b7;
          font-size: 12px;
        }
        .order-total-val {
          color: #4ade80;
          font-size: 15px;
          font-weight: 700;
        }

        .details-toggle {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          background: transparent;
          border: 0.5px solid #1d5c35;
          color: #6ee7b7;
          font-size: 11.5px;
          font-weight: 600;
          padding: 7px;
          border-radius: 8px;
          cursor: pointer;
          margin-bottom: 4px;
          font-family: 'DM Sans', sans-serif;
          transition: background 0.15s ease, border-color 0.15s ease;
        }
        .details-toggle:hover {
          background: rgba(74, 222, 128, 0.08);
          border-color: #4ade80;
        }
        .chevron {
          transition: transform 0.2s ease;
        }
        .chevron-up {
          transform: rotate(180deg);
        }

        .details-panel {
          overflow: hidden;
          margin-bottom: 10px;
        }
        .details-section {
          padding: 10px 2px;
          border-top: 0.5px solid #17351f;
        }
        .details-section:first-child {
          border-top: none;
        }
        .details-section-title {
          color: #6ee7b7;
          font-size: 10px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          font-weight: 600;
          margin-bottom: 6px;
        }
        .details-line {
          color: #d1fae5;
          font-size: 12.5px;
          line-height: 1.5;
        }
        .details-gift-note {
          font-style: italic;
          color: #a7f3d0;
        }

        .details-item-row {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 5px 0;
        }
        .details-item-img {
          width: 32px;
          height: 32px;
          border-radius: 6px;
          object-fit: cover;
          flex-shrink: 0;
        }
        .details-item-info {
          display: flex;
          flex-direction: column;
          flex: 1;
          min-width: 0;
        }
        .details-item-name {
          color: #d1fae5;
          font-size: 12px;
          font-weight: 500;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .details-item-meta {
          color: #6ee7b7;
          font-size: 10.5px;
        }
        .details-item-subtotal {
          color: #4ade80;
          font-size: 12px;
          font-weight: 600;
          flex-shrink: 0;
        }

        .pay-btn {
          display: block;
          width: 100%;
          background: #16a34a;
          color: #fff;
          text-align: center;
          padding: 10px;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 500;
          font-family: 'DM Sans', sans-serif;
          text-decoration: none;
          letter-spacing: 0.03em;
          transition: background 0.15s;
        }
        .pay-btn:hover {
          background: #15803d;
        }
      `}</style>
    </motion.div>
  );
}