"use client";

import { useState, useEffect, useRef, useCallback, useSyncExternalStore } from "react";

// --- TypeScript definitions for the Web Speech API ---

interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  lang: string;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognition;

type SpeechRecognitionWindow = Window &
  typeof globalThis & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

// --- End of TypeScript definitions ---

interface VoiceInputProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
  language?: "en" | "si" | "ta" | "tanglish";
}

// Map our language codes to Web Speech API language codes
const LANG_MAP: Record<string, string[]> = {
  si: ["si-LK", "en-US"],   // Sinhala — fallback to English
  ta: ["ta-LK", "ta-IN"],   // Tamil Sri Lanka → Tamil India
  en: ["en-US"],
  tanglish: ["en-US"],       // Tanglish uses English recognition
};

function subscribeToSpeechSupport() {
  return () => {};
}

function getSpeechSupportSnapshot() {
  return (
    typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window)
  );
}

export function VoiceInputButton({ onTranscript, disabled, language = "en" }: VoiceInputProps) {
  const [isListening, setIsListening] = useState(false);
  const isSupported = useSyncExternalStore(
    subscribeToSpeechSupport,
    getSpeechSupportSnapshot,
    () => false
  );
  const [interimText, setInterimText] = useState("");
  const [permissionError, setPermissionError] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const finalTranscriptRef = useRef("");

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
    setInterimText("");
  }, []);

  const startListening = useCallback(() => {
    if (!isSupported) {
      alert("Voice input is not supported in your browser. Try Chrome or Edge.");
      return;
    }

    setPermissionError(false);

    const speechWindow = window as SpeechRecognitionWindow;
    const SpeechRecognitionAPI =
      speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      alert("Voice input is not supported in your browser. Try Chrome or Edge.");
      return;
    }

    const recognition: SpeechRecognition = new SpeechRecognitionAPI();

    // Config
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.lang = LANG_MAP[language]?.[0] || "en-US";

    finalTranscriptRef.current = "";

    recognition.onstart = () => {
      setIsListening(true);
      setInterimText("");
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      let final = finalTranscriptRef.current;

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += transcript + " ";
        } else {
          interim = transcript;
        }
      }

      finalTranscriptRef.current = final;
      setInterimText(interim);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error("Speech recognition error:", event.error);
      if (event.error === "not-allowed") {
        setPermissionError(true);
      }
      setIsListening(false);
      setInterimText("");
    };

    recognition.onend = () => {
      setIsListening(false);
      setInterimText("");
      const final = finalTranscriptRef.current.trim();
      if (final) {
        onTranscript(final);
      }
      finalTranscriptRef.current = "";
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [isSupported, language, onTranscript]);

  const toggle = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  // Clean up on unmount
  useEffect(() => {
    return () => recognitionRef.current?.abort();
  }, []);

  if (!isSupported) return null;

  return (
    <>
      <div className="voice-wrap">
        <button
          type="button"
          onClick={toggle}
          disabled={disabled}
          className={`voice-btn send-btn ${isListening ? "listening" : ""}`}
          aria-label={isListening ? "Stop recording" : "Start voice input"}
          title={isListening ? "Tap to stop" : "Tap to speak"}
        >
          {isListening ? (
            // Waveform icon while listening
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="12" y1="2" x2="12" y2="22" />
              <line x1="8" y1="5" x2="8" y2="19" />
              <line x1="4" y1="8" x2="4" y2="16" />
              <line x1="16" y1="5" x2="16" y2="19" />
              <line x1="20" y1="8" x2="20" y2="16" />
            </svg>
          ) : (
            // Mic icon when idle
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          )}
        </button>

        {/* Interim transcript bubble */}
        {isListening && (
          <div className="interim-bubble">
            <div className="pulse-ring" />
            <span className="interim-text">
              {interimText || "Listening..."}
            </span>
          </div>
        )}

        {/* Permission denied error bubble */}
        {permissionError && (
          <div className="interim-bubble error-bubble">
            <span className="interim-text">
              Mic access denied.
              <button onClick={() => setPermissionError(false)} title="Dismiss">×</button>
            </span>
          </div>
        )}
      </div>

      <style>{`
        .voice-wrap {
          position: relative;
          display: flex;
          align-items: center;
          flex-shrink: 0;
        }

        .voice-btn {
          width: 38px; height: 38px;
          border-radius: 50%;
          background: var(--color-bg-tertiary);
          border: 0.5px solid var(--color-border);
          cursor: pointer;
          color: var(--color-text-secondary);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: border-color 0.15s, color 0.15s, background 0.15s, transform 0.15s;
          position: relative;
        }

        .voice-btn:hover:not(:disabled) {
          border-color: #ff6b3560;
          color: #ff6b35;
        }

        .voice-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* Listening state */
        .voice-btn.listening {
          background: #ff6b35;
          border-color: #ff6b35;
          color: #fff;
          animation: voicePulse 1.5s ease-in-out infinite;
        }

        @keyframes voicePulse {
          0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(255, 107, 53, 0.4); }
          50% { transform: scale(1.05); box-shadow: 0 0 0 8px rgba(255, 107, 53, 0); }
        }

        /* Interim transcript bubble */
        .interim-bubble {
          position: absolute;
          bottom: calc(100% + 10px);
          right: 0;
          background: var(--color-bg-secondary);
          border: 0.5px solid var(--color-border);
          border-radius: 14px 14px 4px 14px;
          padding: 8px 12px;
          min-width: 140px;
          max-width: 260px;
          display: flex;
          align-items: center;
          gap: 8px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.2);
          z-index: 10;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .error-bubble {
          background: #ffebee;
          border-color: #f44336;
          border-radius: 14px;
        }
        html.dark .error-bubble {
          background: #2d1a1a;
          border-color: #a33;
        }
        .error-bubble .interim-text { color: #d32f2f; display: flex; align-items: center; gap: 6px; }
        html.dark .error-bubble .interim-text { color: #ff8a80; }
        .error-bubble button { background: none; border: none; color: inherit; font-size: 16px; cursor: pointer; padding: 0; line-height: 1; opacity: 0.7; }
        .error-bubble button:hover { opacity: 1; }


        .pulse-ring {
          width: 8px; height: 8px;
          border-radius: 50%;
          background: #ff6b35;
          flex-shrink: 0;
          animation: pulseRing 1s ease-in-out infinite;
        }

        @keyframes pulseRing {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.3); }
        }

        .interim-text {
          color: var(--color-text-secondary);
          font-size: 12px;
          font-family: 'DM Sans', sans-serif;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
      `}</style>
    </>
  );
}
