import { NextResponse } from "next/server";
import { SYSTEM_PROMPT } from "@/lib/prompt";
import { searchProducts, createOrder, trackOrder } from "@/lib/kapruka";
import { detectLanguage, getLanguageInstruction } from "@/lib/i18n";
import type { ChatRequest, Product, Order } from "@/types";


const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

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

    // Detect language from latest user message
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
    const lang = lastUserMsg ? detectLanguage(lastUserMsg.content) : "en";
    const langInstruction = getLanguageInstruction(lang);

    // Build context injection
    const contextParts: string[] = [];
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
        generationConfig: { maxOutputTokens: 1024 },
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

    // Handle explicit checkout trigger
    if (
      text.includes("[CREATE_ORDER]") &&
      sessionData?.cart?.length &&
      sessionData?.address &&
      sessionData?.recipientName &&
      sessionData?.recipientPhone
    ) {
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
        };
        text = text.replace("[CREATE_ORDER]", "").trim();
        text += `\n<order>${JSON.stringify(order)}</order>`;
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
