const MCP_ENDPOINT = "https://mcp.kapruka.com/mcp";

async function callMCP(method: string, params: Record<string, unknown> = {}) {
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
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`MCP error: ${res.status} ${res.statusText}`);
  }

  const contentType = res.headers.get("content-type") || "";

  // Handle SSE stream
  if (contentType.includes("text/event-stream")) {
    const text = await res.text();
    const lines = text.split("\n").filter((l) => l.startsWith("data: "));
    for (const line of lines) {
      try {
        const data = JSON.parse(line.replace("data: ", ""));
        if (data?.result) return data.result;
      } catch {}
    }
    throw new Error("No result in SSE stream");
  }

  const data = await res.json();
  if (data.error) throw new Error(data.error.message || "MCP error");
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
    const result = await callMCP("track_order", { order_id: orderId });
    return result;
  } catch (err) {
    console.error("trackOrder error:", err);
    return null;
  }
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

  return arr.map((p: Record<string, unknown>, i: number) => ({
    id: String(p.id || p.product_id || i),
    name: String(p.name || p.title || "Product"),
    price: Number(p.price || p.unit_price || 0),
    image: String(p.image || p.image_url || p.thumbnail || ""),
    url: String(p.url || p.product_url || ""),
    desc: String(p.description || p.short_description || ""),
    category: String(p.category || ""),
  }));
}
