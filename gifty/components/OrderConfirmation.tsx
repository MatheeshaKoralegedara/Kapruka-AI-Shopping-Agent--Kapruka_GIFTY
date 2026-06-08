"use client";

import { motion } from "framer-motion";
import type { Order } from "@/types";

interface OrderConfirmationProps {
  order: Order;
}

export function OrderConfirmation({ order }: OrderConfirmationProps) {
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
          max-width: 260px;
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
          margin-bottom: 12px;
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
