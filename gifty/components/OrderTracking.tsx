"use client";

import { motion } from "framer-motion";
import type { OrderTracking as OrderTrackingType } from "@/types";

interface OrderTrackingProps {
  tracking: OrderTrackingType;
}

export function OrderTracking({ tracking }: OrderTrackingProps) {
  const { title, status, rows, deliveringTo, progress, footer } = parseTrackingMarkdown(
    tracking.markdown
  );

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="tracking-card"
    >
      <div className="tracking-header">
        <span className={`status-dot ${status === "Delivered" ? "delivered" : "pending"}`} />
        <span className="tracking-title">{title}</span>
      </div>

      {rows.length > 0 && (
        <div className="tracking-rows">
          {rows.map(([label, value]) => (
            <div className="tracking-row" key={label}>
              <span className="tracking-label">{label}</span>
              <span className="tracking-value">{value}</span>
            </div>
          ))}
        </div>
      )}

      {deliveringTo.length > 0 && (
        <div className="tracking-section">
          <div className="tracking-section-title">Delivering to</div>
          {deliveringTo.map((line, i) => (
            <div className="tracking-address-line" key={i}>{line}</div>
          ))}
        </div>
      )}

      {progress.length > 0 && (
        <div className="tracking-section">
          <div className="tracking-section-title">Progress</div>
          <div className="tracking-timeline">
            {progress.map((step, i) => (
              <div className="timeline-step" key={i}>
                <span className="timeline-dot" />
                <span className="timeline-text">{step}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {footer && <div className="tracking-footer">{footer}</div>}

      <style>{`
        .tracking-card {
          background: #161616;
          border: 0.5px solid #2a2a2a;
          border-radius: 14px;
          padding: 14px;
          max-width: 280px;
          font-family: 'DM Sans', sans-serif;
        }
        .tracking-header {
          display: flex;
          align-items: center;
          gap: 7px;
          margin-bottom: 10px;
        }
        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .status-dot.delivered { background: #4ade80; }
        .status-dot.pending { background: #ff9500; }
        .tracking-title {
          color: #f0f0f0;
          font-size: 13px;
          font-weight: 600;
        }
        .tracking-rows {
          background: #0e0e0e;
          border-radius: 8px;
          padding: 8px 10px;
          margin-bottom: 10px;
        }
        .tracking-row {
          display: flex;
          justify-content: space-between;
          font-size: 11px;
          padding: 3px 0;
        }
        .tracking-label { color: #888; }
        .tracking-value { color: #e0e0e0; text-align: right; }
        .tracking-section { margin-bottom: 10px; }
        .tracking-section-title {
          color: #ff9500;
          font-size: 10.5px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          margin-bottom: 6px;
        }
        .tracking-address-line {
          color: #c4c4c4;
          font-size: 11.5px;
          line-height: 1.5;
        }
        .tracking-timeline {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .timeline-step {
          display: flex;
          align-items: flex-start;
          gap: 7px;
        }
        .timeline-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: #4ade80;
          margin-top: 5px;
          flex-shrink: 0;
        }
        .timeline-text {
          color: #b0b0b0;
          font-size: 11px;
          line-height: 1.5;
        }
        .tracking-footer {
          color: #666;
          font-size: 10px;
          font-style: italic;
          margin-top: 6px;
        }
      `}</style>
    </motion.div>
  );
}

function parseTrackingMarkdown(markdown: string) {
  const lines = markdown.split("\n").map((l) => l.trim()).filter(Boolean);

  const titleLine = lines.find((l) => l.startsWith("##"));
  const titleRaw = titleLine?.replace(/^##\s*/, "").replace(/`/g, "") || "Order Status";
  const status = titleRaw.includes("—") ? titleRaw.split("—").pop()?.trim() || "" : "";
  const title = titleRaw;

  const rows: [string, string][] = [];
  lines
    .filter((l) => l.startsWith("|") && !l.includes("---"))
    .forEach((l) => {
      const cells = l.split("|").map((c) => c.trim()).filter(Boolean);
      if (cells.length === 2) {
        rows.push([cells[0], formatValue(cells[1])]);
      }
    });

  const deliveringTo: string[] = [];
  let inDeliveringTo = false;
  for (const l of lines) {
    if (l.toLowerCase().startsWith("**delivering to")) {
      inDeliveringTo = true;
      continue;
    }
    if (inDeliveringTo) {
      if (l.startsWith("- ")) {
        deliveringTo.push(l.replace(/^-\s*/, ""));
      } else {
        inDeliveringTo = false;
      }
    }
  }

  const progress: string[] = [];
  let inProgress = false;
  for (const l of lines) {
    if (l.toLowerCase().startsWith("**progress")) {
      inProgress = true;
      continue;
    }
    if (inProgress) {
      if (l.startsWith("- ")) {
        progress.push(l.replace(/^-\s*/, ""));
      } else {
        inProgress = false;
      }
    }
  }

  const footerLine = lines.find((l) => l.startsWith("_") && l.endsWith("_"));
  const footer = footerLine?.replace(/_/g, "") || "";

  return { title, status, rows, deliveringTo, progress, footer };
}

function formatValue(value: string): string {
  // Handle Python-dict-looking values like {'value': '26060', 'currency': 'LKR'}
  const dictMatch = value.match(/'value':\s*'([^']+)'.*'currency':\s*'([^']+)'/);
  if (dictMatch) {
    const amount = Number(dictMatch[1]).toLocaleString();
    return `${dictMatch[2]} ${amount}`;
  }
  return value;
}