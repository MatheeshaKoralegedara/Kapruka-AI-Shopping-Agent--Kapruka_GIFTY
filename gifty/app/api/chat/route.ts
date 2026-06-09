import { NextResponse } from "next/server";
import { SYSTEM_PROMPT } from "@/lib/prompt";
import { searchProducts, createOrder } from "@/lib/kapruka";
import { detectLanguage, getLanguageInstruction } from "@/lib/i18n";
import type { ChatRequest, Product, Order } from "@/types";

const GROQ_API_KEY = process.env.GROQ_API_KEY!;
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

async function callGroq(systemPrompt: string, messages: { role: string; content: string }[], retries = 3): Promise<string> {
  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      max_tokens: 1024,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ],
    }),
  });

  const data = await res.json();

  if (res.status === 429 && retries > 0) {
    const retryAfter = res.headers.get("retry-after");
    const delay = retryAfter ? parseFloat(retryAfter) * 1000 : 2000;
    await new Promise((r) => setTimeout(r, delay));
    return callGroq(systemPrompt, messages, retries - 1);
  }

  if (!res.ok) throw new Error(data?.error?.message || "Groq API error");

  return data.choices?.[0]?.message?.content ?? "";
}

export async function POST(req: Request) {
  try {
    const body: ChatRequest = await req.json();
    const { messages, sessionData } = body;

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

    let text = await callGroq(systemWithContext, messages);

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

    // Fallback search detection
    const searchMatch = text.match(/\[SEARCH:\s*"([^"]+)"\]/i);
    if (!products && (
      text.toLowerCase().includes("let me search") ||
      text.toLowerCase().includes("searching") ||
      text.toLowerCase().includes("finding gifts") ||
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

    // Handle checkout trigger
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

    // Clean XML tags from display text
    const cleanText = text
      .replace(/<products>[\s\S]*?<\/products>/g, "")
      .replace(/<order>[\s\S]*?<\/order>/g, "")
      .replace(/<delivery>[\s\S]*?<\/delivery>/g, "")
      .replace(/\[SEARCH:[^\]]+\]/gi, "")
      .replace(/\[CREATE_ORDER\]/gi, "")
      .trim();

    return NextResponse.json({
      text: cleanText,
      products: products?.length ? products : undefined,
      order,
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