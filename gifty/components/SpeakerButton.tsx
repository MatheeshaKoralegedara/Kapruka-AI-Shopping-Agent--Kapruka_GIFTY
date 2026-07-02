"use client";

type SpeakerButtonProps = {
  isSpeaking: boolean;
  onToggle: () => void;
  disabled?: boolean;
};

export function SpeakerButton({ isSpeaking, onToggle, disabled }: SpeakerButtonProps) {
  return (
    <button
      type="button"
      className={`speaker-btn ${isSpeaking ? "speaker-btn-active" : ""}`}
      onClick={onToggle}
      disabled={disabled}
      aria-label={isSpeaking ? "Stop reading message aloud" : "Read message aloud"}
      title={isSpeaking ? "Stop" : "Listen"}
    >
      {isSpeaking ? (
        // Stop / speaking icon (animated bars)
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
          <path d="M11 5 6 9H2v6h4l5 4V5Z" />
          <path className="speaker-wave speaker-wave-1" d="M16 8a5 5 0 0 1 0 8" />
          <path className="speaker-wave speaker-wave-2" d="M19 5a9 9 0 0 1 0 14" />
        </svg>
      ) : (
        // Muted / idle speaker icon
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
          <path d="M11 5 6 9H2v6h4l5 4V5Z" />
          <path d="M16 8a5 5 0 0 1 0 8" opacity="0.55" />
        </svg>
      )}

      <style jsx>{`
        .speaker-btn {
          width: 26px;
          height: 26px;
          border-radius: 50%;
          border: 0.5px solid var(--color-border);
          background: var(--color-bg-tertiary);
          color: var(--color-text-secondary);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          flex-shrink: 0;
          transition: border-color 0.15s ease, color 0.15s ease, background 0.15s ease;
        }
        .speaker-btn:hover:not(:disabled) {
          border-color: #ff6b3560;
          color: #ff6b35;
        }
        .speaker-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
        .speaker-btn-active {
          background: #ff6b35;
          border-color: #ff6b35;
          color: #fff;
        }
        .speaker-wave-1 {
          animation: pulse 0.9s ease-in-out infinite;
        }
        .speaker-wave-2 {
          animation: pulse 0.9s ease-in-out infinite 0.15s;
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .speaker-wave-1, .speaker-wave-2 { animation: none; }
        }
      `}</style>
    </button>
  );
}