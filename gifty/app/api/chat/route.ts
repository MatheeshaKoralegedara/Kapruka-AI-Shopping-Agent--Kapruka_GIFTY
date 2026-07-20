import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import * as chrono from "chrono-node";
import { SYSTEM_PROMPT } from "@/lib/prompt";
import { searchProducts, createOrder, trackOrder } from "@/lib/kapruka";
import { detectLanguage, getLanguageInstruction } from "@/lib/i18n";
import { computeCartSignature } from "@/lib/Ordersignature";
import {
  getRedisClient,
  getOrCreateSessionId,
  getExistingOrder,
  saveOrder,
  acquireLock,
  releaseLock,
} from "@/lib/orderStore";
import type { ChatRequest, Product, Order } from "@/types";


const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${GEMINI_API_KEY}`;

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
  error?: {
    message?: string;
  };
};

export async function POST(req: Request) {
  try {
    const body: ChatRequest = await req.json();
    const { messages, sessionData, imageData } = body;

    if (!messages?.length) {
      return NextResponse.json({ error: "No messages provided" }, { status: 400 });
    }

    // Server-owned session identity + idempotency store. Unlike the old
    // client-echoed existingOrder/existingOrderSignature fields, this can't
    // be omitted or spoofed to bypass duplicate-order protection.
    const cookieStore = await cookies();
    const sessionId = getOrCreateSessionId(cookieStore);
    const redis = getRedisClient();

    // Detect language from latest user message
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
    const lang = lastUserMsg ? detectLanguage(lastUserMsg.content) : "en";
    const langInstruction = getLanguageInstruction(lang);

    // Build context injection
    const contextParts: string[] = [];

    // The model has no reliable sense of "today" on its own — without this,
    // it can accept delivery dates that are already in the past (seen live:
    // accepting "2026/06/23" when the actual date was 2026/07/02). Always
    // give it the real current date in Sri Lanka time.
    const todayInSriLanka = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Colombo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date()); // en-CA gives YYYY-MM-DD format
    contextParts.push(`[Today's date: ${todayInSriLanka} (Sri Lanka time, Asia/Colombo)]`);

    if (sessionData?.cart?.length) {
      contextParts.push(`[Cart: ${sessionData.cart.length} items, total Rs. ${sessionData.cart.reduce((s, i) => s + i.price * i.quantity, 0).toLocaleString()}]`);
    }
    if (sessionData?.address) contextParts.push(`[Address collected: ${sessionData.address}]`);
    if (sessionData?.recipientName) contextParts.push(`[Recipient: ${sessionData.recipientName}]`);
    if (sessionData?.recipientPhone) contextParts.push(`[Phone: ${sessionData.recipientPhone}]`);
    if (sessionData?.deliveryDate) contextParts.push(`[Delivery date: ${sessionData.deliveryDate}]`);

    const systemWithContext = `${SYSTEM_PROMPT}

## CURRENT SESSION
${contextParts.length ? contextParts.join("\n") : "New conversation — no cart or address yet."}

## LANGUAGE INSTRUCTION
${langInstruction}`;

    if (imageData?.base64 && imageData.mimeType) {
      const imageSearchQuery = await describeImageForSearch(
        imageData,
        lastUserMsg?.content || ""
      );
      const products = (await searchProducts(imageSearchQuery)).slice(0, 5);
      const text = await generateImageSearchReply(
        imageSearchQuery,
        products,
        langInstruction
      );

      return NextResponse.json({
        text,
        products: products.length ? products : undefined,
        language: lang,
      });
    }

    // Gemini API call
    const geminiRes = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemWithContext }] },
        contents: messages.map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        })),
        generationConfig: {
          maxOutputTokens: 1024,
          thinkingConfig: { thinkingLevel: "low" },
        },
      }),
    });

    const geminiData = await geminiRes.json();

    if (!geminiRes.ok) {
      throw new Error(geminiData?.error?.message || "Gemini API error");
    }

    let text: string =
      geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    // Extract product search intent
    const searchMatch = text.match(/\[SEARCH:\s*"([^"]+)"\]/i);
    let products: Product[] | undefined;
    let order: Order | undefined;

    // Parse embedded <products> block
    const productsMatch = text.match(/<products>([\s\S]*?)<\/products>/);
    if (productsMatch) {
      try {
        const parsed = JSON.parse(productsMatch[1].trim());
        const hasFakeIds = parsed.some((p: Product) => !p.id || p.id === "REAL_ID");
        if (hasFakeIds || parsed.length === 0) {
          const query = extractSearchQuery(messages);
          const realProducts = await searchProducts(query);
          if (realProducts.length > 0) {
            products = realProducts.slice(0, 5);
            text = text.replace(/<products>[\s\S]*?<\/products>/, `<products>${JSON.stringify(products)}</products>`);
          }
        } else {
          products = parsed;
        }
      } catch {
        const query = extractSearchQuery(messages);
        products = (await searchProducts(query)).slice(0, 5);
      }
    }

    // Fallback: if Claude signals intent to search
    if (!products && (
      text.toLowerCase().includes("let me search") ||
      text.toLowerCase().includes("searching") ||
      text.toLowerCase().includes("finding") ||
      searchMatch
    )) {
      const query = searchMatch?.[1] || extractSearchQuery(messages);
      products = (await searchProducts(query)).slice(0, 5);
      if (products.length > 0) {
        text = text + `\n<products>${JSON.stringify(products)}</products>`;
      }
    }

    // Parse order block
    const orderMatch = text.match(/<order>([\s\S]*?)<\/order>/);
    if (orderMatch) {
      try {
        order = JSON.parse(orderMatch[1].trim());
      } catch {}
    }

    // --- Idempotent order handling ---------------------------------------
    // Before considering a fresh checkout, check whether an order already
    // exists (server-side, in Redis) for the EXACT current
    // cart/address/recipient/date state (signature match). If so, we never
    // call createOrder() again this turn — we just re-attach the existing
    // order, whether the model re-emitted [CREATE_ORDER] or the user simply
    // asked for order details. This lookup is keyed by our own gifty_sid
    // cookie + signature, not by anything the client body can override.
    const currentSignature = computeCartSignature({
      cart: sessionData?.cart,
      address: sessionData?.address,
      recipientName: sessionData?.recipientName,
      recipientPhone: sessionData?.recipientPhone,
      deliveryDate: sessionData?.deliveryDate,
    });
    const existingOrder = await getExistingOrder(redis, sessionId, currentSignature);

    if (existingOrder) {
      order = existingOrder;

      // The model sometimes narrates order details in prose that LOOKS like
      // the real order card (e.g. "Order confirmed! Order #... Total Rs...
      // [Pay now →](url)") even when told not to — it just avoids the exact
      // forbidden phrasing without avoiding the underlying behavior. Rather
      // than trying to regex-detect every way it could phrase that, we
      // simply don't trust the model's text at all once we know we're just
      // re-showing an existing order: replace it with a short, consistent
      // message and let the real <order> card (with the REAL pay link)
      // carry the actual information.
      const looksLikeOrderNarration =
        text.includes("[CREATE_ORDER]") ||
        /order\s*#|order\s*confirmed|total[:\s]*rs\.?|pay\s*now|payment\s*link|\]\(https?:\/\//i.test(
          text
        );

      if (looksLikeOrderNarration) {
        text = "Here's your order — tap below to see everything! 👇";
      }

      // Make sure the order card actually renders even if this turn's
      // reply is plain text (e.g. user just asked "give me order details").
      if (!text.includes("<order>")) {
        text += `\n<order>${JSON.stringify(order)}</order>`;
      }
    } else if (
      text.includes("[CREATE_ORDER]") &&
      sessionData?.cart?.length &&
      sessionData?.address &&
      sessionData?.recipientName &&
      sessionData?.recipientPhone
    ) {
      // --- Hard guard against past delivery dates -----------------------
      // Belt-and-suspenders on top of the "today's date" context injection
      // above: even if the model still gets this wrong, never let a
      // backdated order actually reach createOrder().
      const dateIssue = getPastDateIssue(sessionData.deliveryDate, todayInSriLanka);
      if (dateIssue) {
        text = text.replace("[CREATE_ORDER]", "").trim();
        text += `\n\n${dateIssue}`;
      } else {
        // No dedup record found for this signature. This is the expected
        // path for a genuinely new order, but per the documented limitation
        // in lib/orderStore.ts it's ALSO what a TTL-expired (>7 day-old)
        // duplicate looks like — we can't tell those apart with a TTL-based
        // store. Logged distinctly so it's greppable if duplicates are ever
        // reported.
        console.info(
          `[order-idempotency] no existing record for session=${sessionId} — proceeding to create. ` +
            `(If this exact cart/address/recipient/date was already ordered more than 7 days ago, ` +
            `that dedup record would have expired and this will NOT be caught as a duplicate.)`
        );

        let lockAcquired = false;
        try {
          lockAcquired = await acquireLock(redis, sessionId, currentSignature);

          if (!lockAcquired) {
            // Another in-flight request (double-click, client retry) is
            // already creating this exact order — don't call createOrder()
            // twice. Ask the user to wait rather than silently no-op.
            text = text.replace("[CREATE_ORDER]", "").trim();
            text += "\n\nHold on, I'm still processing your order — one moment! 🙏";
          } else {
            // TODO(cart-price-trust): sessionData.cart items (and their
            // prices) are entirely client-supplied and trusted as-is for
            // the order total below. A tampered client could submit
            // mismatched prices. Out of scope for the idempotency work —
            // needs server-side price verification against the Kapruka
            // catalog (via MCP) before this ships to production traffic.
            const orderResult = await createOrder({
              items: sessionData.cart.map((i) => ({ product_id: i.id, quantity: i.quantity })),
              delivery_address: sessionData.address,
              recipient_name: sessionData.recipientName,
              recipient_phone: sessionData.recipientPhone,
              delivery_date: sessionData.deliveryDate,
              gift_note: sessionData.giftNote,
            });

            if (orderResult?.pay_link || orderResult?.payLink) {
              order = {
                payLink: orderResult.pay_link || orderResult.payLink,
                orderId: orderResult.order_id || orderResult.orderId || "ORD-" + Date.now(),
                total: sessionData.cart.reduce((s, i) => s + i.price * i.quantity, 0),
                // Carried through so the chat UI can show a full order-details
                // breakdown before/after payment, not just the total.
                items: sessionData.cart.map((i) => ({
                  id: i.id,
                  name: i.name,
                  price: i.price,
                  quantity: i.quantity,
                  image: i.image,
                })),
                deliveryAddress: sessionData.address,
                recipientName: sessionData.recipientName,
                recipientPhone: sessionData.recipientPhone,
                deliveryDate: sessionData.deliveryDate,
                giftNote: sessionData.giftNote,
              };
              await saveOrder(redis, sessionId, currentSignature, order);
              text = text.replace("[CREATE_ORDER]", "").trim();
              text += `\n<order>${JSON.stringify(order)}</order>`;
            } else {
              console.error(
                `[order-idempotency] createOrder returned no pay link for session=${sessionId}`
              );
              text = text.replace("[CREATE_ORDER]", "").trim();
              text +=
                "\n\nSorry, I couldn't place your order just now — please try again in a moment.";
            }
          }
        } catch (err) {
          console.error("[order-idempotency] order creation failed:", err);
          text = text.replace("[CREATE_ORDER]", "").trim();
          text += "\n\nSorry, something went wrong while placing your order — please try again.";
        } finally {
          // Always release, and only release what we actually acquired —
          // this must run even if createOrder() throws, so a failed attempt
          // never leaves this cart signature soft-locked for the full 15s
          // with no way for the user to retry sooner.
          if (lockAcquired) {
            await releaseLock(redis, sessionId, currentSignature);
          }
        }
      }
    }

    // Handle order tracking trigger (independent of checkout)
    const trackMatch = text.match(/\[TRACK_ORDER:\s*"([^"]+)"\]/i);
    let tracking: unknown;
    if (trackMatch) {
      const trackingResult = await trackOrder(trackMatch[1]);
      if (trackingResult) {
        tracking = trackingResult;
        text = text.replace(/\[TRACK_ORDER:[^\]]+\]/i, "").trim();
        if (!text) {
          text = "Here's the latest update on your order:";
        }
        text += `\n<tracking>${JSON.stringify(trackingResult)}</tracking>`;
      } else {
        text = text.replace(/\[TRACK_ORDER:[^\]]+\]/i, "").trim();
        if (!text) {
          text = "I couldn't find tracking info for that order — could you double check the order number?";
        }
      }
    }

    // Clean XML tags from display text
   const cleanText = text
      .replace(/<products>[\s\S]*?<\/products>/g, "")
      .replace(/<order>[\s\S]*?<\/order>/g, "")
      .replace(/<tracking>[\s\S]*?<\/tracking>/g, "")
      .replace(/<delivery>[\s\S]*?<\/delivery>/g, "")
      .replace(/\[SEARCH:[^\]]+\]/gi, "")
      .replace(/\[CREATE_ORDER\]/gi, "")
      .replace(/\[TRACK_ORDER:[^\]]+\]/gi, "")
      .trim();

    return NextResponse.json({
      text: cleanText,
      products: products?.length ? products : undefined,
      order,
      tracking,
      language: lang,
    });
    
  } catch (err) {
    console.error("Chat API error:", err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}

/**
 * Returns a friendly message explaining the issue if the given delivery
 * date is in the past (relative to the real current date in Sri Lanka),
 * or null if the date is valid / unparseable-but-not-obviously-wrong.
 *
 * This is a hard backstop: even if the model ignores the "today's date"
 * context and tries to confirm a backdated order, this prevents
 * createOrder() from ever being called with it.
 */
function getPastDateIssue(deliveryDate: string | undefined, todayISO: string): string | null {
  if (!deliveryDate) return null;

  const today = new Date(todayISO + "T00:00:00");
  const parsed = parseLooseDate(deliveryDate, today);
  if (!parsed) return null; // Can't confidently parse — don't block

  if (parsed.getTime() < today.getTime()) {
    return `That date (${deliveryDate}) has already passed — today is ${todayISO}. Could you give me a valid upcoming delivery date?`;
  }
  return null;
}

/**
 * Best-effort parse of a delivery date string, including natural language
 * like "23rd June" or "next Tuesday" (via chrono-node), so the past-date
 * backstop above isn't limited to numeric YYYY-MM-DD formats.
 * `referenceDate` anchors relative phrases ("next Tuesday", "tomorrow").
 * Returns null if unparseable.
 */
function parseLooseDate(value: string, referenceDate: Date): Date | null {
  const trimmed = value.trim();

  const numeric = trimmed.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (numeric) {
    const [, y, m, d] = numeric;
    const date = new Date(`${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}T00:00:00`);
    return isNaN(date.getTime()) ? null : date;
  }

  const parsed = chrono.parseDate(trimmed, referenceDate, { forwardDate: true });
  if (!parsed) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

function extractSearchQuery(messages: { role: string; content: string }[]): string {
  const recentUser = messages
    .filter((m) => m.role === "user")
    .slice(-3)
    .map((m) => m.content)
    .join(" ");

  if (/அம்மா|amma|mother|mom/i.test(recentUser)) return "birthday gift women flowers cake";
  if (/அப்பா|appa|father|dad/i.test(recentUser)) return "gift men watch accessories";
  if (/மனைவி|காதலி|wife|girlfriend/i.test(recentUser)) return "romantic gift flowers chocolate";
  if (/பிறந்தநாள்|birthday/i.test(recentUser)) return "birthday gift cake flowers";
  if (/திருமணம்|wedding/i.test(recentUser)) return "wedding gift home accessories";
  if (/குழந்தை|baby|child|kid/i.test(recentUser)) return "baby gift toys";
  if (/சாக்லேட்|கேக்|chocolate|cake|food/i.test(recentUser)) return "cake chocolate sweets";
  if (/மலர்|பூ|flower/i.test(recentUser)) return "flowers bouquet";

  if (/amma|mother|mom/i.test(recentUser)) return "birthday gift women flowers cake";
  if (/thaththaa|father|dad/i.test(recentUser)) return "gift men watch accessories";
  if (/girlfriend|wife|akka/i.test(recentUser)) return "romantic gift flowers chocolate";
  if (/birthday/i.test(recentUser)) return "birthday gift cake flowers";
  if (/wedding/i.test(recentUser)) return "wedding gift home accessories";
  if (/baby|child|kid/i.test(recentUser)) return "baby gift toys";
  if (/chocolate|cake|food/i.test(recentUser)) return "cake chocolate sweets";
  if (/flower/i.test(recentUser)) return "flowers bouquet";

  const priceMatch = recentUser.match(/(\d{3,6})\s*[-–]\s*(\d{3,6})/);
  if (priceMatch) return `gift ${priceMatch[0]}`;

  return "popular gift sri lanka";
}

async function describeImageForSearch(
  imageData: { base64: string; mimeType: string },
  userNote: string
): Promise<string> {
  const prompt = [
    "Look at this product or gift image and return one concise Kapruka search query.",
    "Use plain English product words only. Mention the main visible item, style, and occasion if obvious.",
    "Keep it under 8 words. Do not include punctuation or explanations.",
    userNote ? `User note: ${userNote}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const data = await callGemini({
    contents: [
      {
        role: "user",
        parts: [
          { text: prompt },
          {
            inline_data: {
              mime_type: imageData.mimeType,
              data: imageData.base64,
            },
          },
        ],
      },
    ],
    generationConfig: {
      maxOutputTokens: 64,
      temperature: 0.2,
      thinkingConfig: { thinkingLevel: "minimal" },
    },
  });

  const query = extractGeminiText(data)
    .replace(/["'`]/g, "")
    .replace(/[.\n\r]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return query || "popular gift sri lanka";
}

async function generateImageSearchReply(
  query: string,
  products: Product[],
  langInstruction: string
): Promise<string> {
  if (!products.length) {
    return `I found this looks like **${query}**, but Kapruka did not return close matches yet. Try another angle or add a few words about the item.`;
  }

  try {
    const data = await callGemini({
      system_instruction: {
        parts: [
          {
            text: `You are Kapruka's GIFTY shopping assistant. ${langInstruction}`,
          },
        ],
      },
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `The uploaded image was summarized as this product search query: "${query}".
Kapruka returned these real products:
${JSON.stringify(products.map((p) => ({ name: p.name, price: p.price, desc: p.desc })))}

Write a short friendly response, max 2 sentences. Mention that you found similar items and invite the user to pick one. Do not invent products.`,
            },
          ],
        },
      ],
      generationConfig: {
        maxOutputTokens: 160,
        temperature: 0.5,
        thinkingConfig: { thinkingLevel: "minimal" },
      },
    });

    const text = extractGeminiText(data).trim();
    if (text) return text;
  } catch (err) {
    console.error("Image reply Gemini error:", err);
  }

  return `I found this looks like **${query}** and pulled up similar Kapruka picks for you. Want me to help choose the best one?`;
}

async function callGemini(payload: Record<string, unknown>) {
  const res = await fetch(GEMINI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data: GeminiResponse = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || "Gemini API error");
  }
  return data;
}

function extractGeminiText(data: GeminiResponse): string {
  return data.candidates?.[0]?.content?.parts
    ?.map((part: { text?: string }) => part.text || "")
    .join("")
    .trim() || "";
}