"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type SupportedLang = "en" | "si" | "ta" | "tanglish";

// BCP-47 language tags to try, in priority order, per app language.
// Sinhala/Tamil native voices are rare on Android/Chrome, so we fall back
// to Indian English (better prosody for South Asian names/words) then
// generic English if nothing closer is installed on the device.
const LANG_VOICE_PRIORITY: Record<SupportedLang, string[]> = {
  en: ["en-US", "en-GB", "en-IN"],
  si: ["si-LK", "en-IN", "en-US"],
  ta: ["ta-IN", "ta-LK", "en-IN", "en-US"],
  tanglish: ["en-IN", "en-US"],
};

function stripForSpeech(raw: string): string {
  return raw
    .replace(/<products>[\s\S]*?<\/products>/g, "")
    .replace(/<order>[\s\S]*?<\/order>/g, "")
    .replace(/<tracking>[\s\S]*?<\/tracking>/g, "")
    .replace(/<delivery>[\s\S]*?<\/delivery>/g, "")
    .replace(/\[SEARCH:[^\]]+\]/gi, "")
    .replace(/\[CREATE_ORDER\]/gi, "")
    .replace(/\[TRACK_ORDER:[^\]]+\]/gi, "")
    .replace(/\*\*(.*?)\*\*/g, "$1") // markdown bold
    .replace(/\*(.*?)\*/g, "$1") // markdown italics
    .replace(/[#_`~]/g, "")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function useTextToSpeech() {
  const [isSupported, setIsSupported] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [autoSpeak, setAutoSpeak] = useState(false);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setIsSupported(false);
      return;
    }
    setIsSupported(true);

    const loadVoices = () => {
      voicesRef.current = window.speechSynthesis.getVoices();
    };
    loadVoices();
    // Voice list loads async on first call in most browsers
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      window.speechSynthesis.onvoiceschanged = null;
      window.speechSynthesis.cancel();
    };
  }, []);

  const pickVoice = useCallback((lang: SupportedLang) => {
    const priorities = LANG_VOICE_PRIORITY[lang] || LANG_VOICE_PRIORITY.en;
    for (const tag of priorities) {
      const match = voicesRef.current.find((v) =>
        v.lang.toLowerCase().startsWith(tag.toLowerCase())
      );
      if (match) return match;
    }
    return voicesRef.current[0];
  }, []);

  const stop = useCallback(() => {
    if (typeof window === "undefined") return;
    window.speechSynthesis.cancel();
    setSpeakingId(null);
  }, []);

  const speak = useCallback(
    (id: string, text: string, lang: SupportedLang = "en") => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

      const clean = stripForSpeech(text);
      if (!clean) return;

      // Toggle off if this message is already speaking
      if (speakingId === id) {
        stop();
        return;
      }

      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(clean);
      const voice = pickVoice(lang);
      if (voice) {
        utterance.voice = voice;
        utterance.lang = voice.lang;
      }
      utterance.rate = 1;
      utterance.pitch = 1;

      utterance.onstart = () => setSpeakingId(id);
      utterance.onend = () => setSpeakingId((cur) => (cur === id ? null : cur));
      utterance.onerror = () => setSpeakingId((cur) => (cur === id ? null : cur));

      window.speechSynthesis.speak(utterance);
    },
    [pickVoice, speakingId, stop]
  );

  return {
    isSupported,
    speakingId,
    speak,
    stop,
    autoSpeak,
    setAutoSpeak,
  };
}