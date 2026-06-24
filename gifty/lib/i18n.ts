import type { Language } from "../types";

// Unicode ranges
const SINHALA_RE = /[\u0D80-\u0DFF]/;
const TAMIL_RE = /[\u0B80-\u0BFF]/;

// Common Tanglish patterns (Sinhala words romanised)
const TANGLISH_RE =
  /\b(eka|ekak|mokak|oni|karanna|denna|ganna|yanna|enawa|yanawa|gift|koheda|kohoma|monawada|hadana|hadanawa|api|mama|amma|thaththa|akka|aiya|nangi|malli|putha|duwa|loku|podi|hondai|nehe|ow|neda|koheda|wada|hari|bari|godak|tikak|awasara|awul|pissu|machan|bro|sis)\b/i;

// Common Taminglish patterns (Tamil words romanised)
const TAMINGLISH_RE =
  /\b(vanakkam|enna|epdi|eppadi|venum|venuma|vendum|irukka|illai|seri|sari|konjam|romba|nalla|nanri|thambi|thangachi|ponnu|paiyan|kudunga|kaamikka|thedu|paarunga|birthday-ku|gift-ku|delivery-ku)\b/i;

export function detectLanguage(text: string): Language {
  if (SINHALA_RE.test(text)) return "si";
  if (TAMIL_RE.test(text)) return "ta";
  if (TAMINGLISH_RE.test(text)) return "ta";
  if (TANGLISH_RE.test(text)) return "tanglish";
  return "en";
}

export function getLanguageInstruction(lang: Language): string {
  switch (lang) {
    case "si":
      return "The user wrote in Sinhala script. Reply in Sinhala script with warmth. You may mix in English product names.";
    case "ta":
      return "The user wrote in Tamil or romanised Tamil. Reply primarily in natural Tamil. If they use romanised Tamil, you may answer in casual romanised Tamil mixed with English. You may mix English for product names and prices.";
    case "tanglish":
      return "The user is writing in Tanglish (romanised Sinhala mixed with English). Match their casual mixed style exactly — natural, warm, like a friend texting. Do not use Sinhala script in your reply.";
    default:
      return "Reply in clear, warm English.";
  }
}

export function greetingByLanguage(lang: Language): string {
  switch (lang) {
    case "si":
      return "ආයුබෝවන් 👋";
    case "ta":
      return "வணக்கம் 👋";
    case "tanglish":
      return "Ayubowan! 👋";
    default:
      return "Hi there! 👋";
  }
}
