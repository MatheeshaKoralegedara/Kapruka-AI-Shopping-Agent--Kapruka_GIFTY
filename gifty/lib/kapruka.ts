const MCP_ENDPOINT = "https://mcp.kapruka.com/mcp";

let cachedSessionId: string | null = null;
let initPromise: Promise<string> | null = null;

async function initSession(): Promise<string> {
  const res = await fetch(MCP_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "init-" + Date.now(),
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "gifty-agent", version: "1.0.0" },
      },
    }),
  });

  const sessionId = res.headers.get("mcp-session-id");
  if (!sessionId) {
    const body = await res.text().catch(() => "");
    throw new Error(`MCP init failed: no session id returned - ${body}`);
  }

  // Some servers also require an "initialized" notification after init
  await fetch(MCP_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      "Mcp-Session-Id": sessionId,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "notifications/initialized",
      params: {},
    }),
  }).catch(() => {});

  return sessionId;
}

async function getSessionId(): Promise<string> {
  if (cachedSessionId) return cachedSessionId;
  if (!initPromise) initPromise = initSession();
  cachedSessionId = await initPromise;
  return cachedSessionId;
}

const MAX_SESSION_RETRIES = 2;

async function callMCP(
  method: string,
  params: Record<string, unknown> = {},
  retriesLeft = MAX_SESSION_RETRIES
) {
  const sessionId = await getSessionId();

  const body = {
    jsonrpc: "2.0",
    id: Date.now(),
    method: "tools/call",
    params: {
      name: method,
      arguments: params,
    },
  };

  const res = await fetch(MCP_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      "Mcp-Session-Id": sessionId,
    },
    body: JSON.stringify(body),
  });

  if (res.status === 400 || res.status === 404) {
    // Session may have expired — reset and retry, up to MAX_SESSION_RETRIES times
    const errBody = await res.text().catch(() => "");
    if (errBody.toLowerCase().includes("session")) {
      if (retriesLeft <= 0) {
        throw new Error(
          `MCP error: session kept expiring after ${MAX_SESSION_RETRIES} retries - ${errBody}`
        );
      }
      cachedSessionId = null;
      initPromise = null;
      return callMCP(method, params, retriesLeft - 1);
    }
    throw new Error(`MCP error: ${res.status} ${res.statusText} - ${errBody}`);
  }

  if (!res.ok) {
    const errorBody = await res.text().catch(() => "");
    throw new Error(`MCP error: ${res.status} ${res.statusText} - ${errorBody}`);
  }

  const contentType = res.headers.get("content-type") || "";

  // Handle SSE stream
  if (contentType.includes("text/event-stream")) {
    const text = await res.text();
    const lines = text.split("\n").filter((l) => l.startsWith("data: "));
    for (const line of lines) {
      try {
        const data = JSON.parse(line.replace("data: ", ""));
        if (data?.result) {
          if (data.result.isError) {
            const msg =
              data.result.content?.[0]?.text || "MCP tool returned an error";
            throw new Error(msg);
          }
          return data.result;
        }
      } catch (e) {
        if (e instanceof Error && e.message !== "Unexpected end of JSON input") {
          // Re-throw real errors (like the isError case above), swallow JSON parse noise
          if (!(e instanceof SyntaxError)) throw e;
        }
      }
    }
    throw new Error("No result in SSE stream");
  }

  const data = await res.json();
  if (data.error) throw new Error(data.error.message || "MCP error");
  if (data.result?.isError) {
    const msg = data.result.content?.[0]?.text || "MCP tool returned an error";
    throw new Error(msg);
  }
  return data.result;
}

export async function searchProducts(query: string, limit = 6) {
  try {
    const result = await callMCP("search_products", { query, limit });
    return normalizeProducts(result);
  } catch (err) {
    console.error("searchProducts error:", err);
    return [];
  }
}

export async function getCategories() {
  try {
    const result = await callMCP("get_categories", {});
    return result;
  } catch (err) {
    console.error("getCategories error:", err);
    return [];
  }
}

export async function quoteDelivery(
  productId: string,
  address: string,
  quantity = 1
) {
  try {
    const result = await callMCP("quote_delivery", {
      product_id: productId,
      delivery_address: address,
      quantity,
    });
    return result;
  } catch (err) {
    console.error("quoteDelivery error:", err);
    return null;
  }
}

export async function createOrder(params: {
  items: { product_id: string; quantity: number }[];
  delivery_address: string;
  recipient_name: string;
  recipient_phone: string;
  delivery_date?: string;
  gift_note?: string;
}) {
  try {
    const result = await callMCP("create_order", params);
    return result;
  } catch (err) {
    console.error("createOrder error:", err);
    return null;
  }
}

export async function trackOrder(orderId: string) {
  try {
    const result = await callMCP("kapruka_track_order", {
      params: { order_number: orderId },
    });

    if (result?.isError) return null;

    const markdown =
      result?.structuredContent?.result ||
      result?.content?.[0]?.text ||
      null;

    return markdown ? { orderId, markdown } : null;
  } catch (err) {
    console.error("trackOrder error:", err);
    return null;
  }
}

// Deterministic string hash (FNV-1a) used only as a fallback product id
function hashString(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

// Normalize whatever shape MCP returns into our Product type
function normalizeProducts(raw: unknown): import("../types").Product[] {
  if (!raw) return [];

  const obj = typeof raw === "object" && raw !== null ? raw as Record<string, unknown> : {};
  const arr = Array.isArray(raw)
    ? raw
    : Array.isArray(obj.products)
    ? obj.products
    : Array.isArray(obj.items)
    ? obj.items
    : [];

  return arr.map((p: Record<string, unknown>) => {
    const name = String(p.name || p.title || "Product");
    const price = Number(p.price || p.unit_price || 0);
    const url = String(p.url || p.product_url || "");
    // Fall back to a hash of name+price+url (not array index) so two
    // different ID-less products never collide and merge in the cart.
    const fallbackId = `gen-${hashString(`${name}|${price}|${url}`)}`;

    return {
      id: String(p.id || p.product_id || fallbackId),
      name,
      price,
      image: String(p.image || p.image_url || p.thumbnail || ""),
      url,
      desc: String(p.description || p.short_description || ""),
      category: String(p.category || ""),
    };
  });
}