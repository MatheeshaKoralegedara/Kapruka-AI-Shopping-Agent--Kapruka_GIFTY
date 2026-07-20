import { Redis } from "@upstash/redis";
import { hashString } from "./hash";
import type { Order } from "@/types";

export const SESSION_COOKIE_NAME = "gifty_sid";

// How long a completed-order record is remembered for dedup purposes.
// See the "TTL vs. genuinely-new" note on getExistingOrder() below —
// this is a deliberate, documented tradeoff, not an oversight.
const ORDER_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

// How long a create-order attempt holds the lock for a given
// session+signature. Only needs to cover one MCP round trip.
const LOCK_TTL_SECONDS = 15;

interface OrderRecord {
  order: Order;
  createdAt: number;
}

// Minimal structural interface so orderStore.ts doesn't hard-depend on the
// concrete @upstash/redis client — a fake implementing this same shape can
// be injected in tests instead of hitting real Redis.
export interface RedisLike {
  get<TData = unknown>(key: string): Promise<TData | null>;
  set<TData = unknown>(
    key: string,
    value: TData,
    opts?: { ex?: number; nx?: true }
  ): Promise<"OK" | TData | null>;
  del(key: string): Promise<number>;
}

// Minimal structural interface matching the object next/headers' cookies()
// resolves to in a Route Handler (read + write). Kept narrow so a plain
// fake object works in tests without pulling in Next.js internals.
export interface CookieJar {
  get(name: string): { value: string } | undefined;
  set(
    name: string,
    value: string,
    options?: {
      httpOnly?: boolean;
      secure?: boolean;
      sameSite?: "lax" | "strict" | "none";
      path?: string;
      maxAge?: number;
    }
  ): void;
}

let redisSingleton: Redis | null = null;

/** Lazily creates the real Upstash client from UPSTASH_REDIS_REST_URL / _TOKEN env vars. */
export function getRedisClient(): RedisLike {
  if (!redisSingleton) {
    redisSingleton = Redis.fromEnv();
  }
  return redisSingleton;
}

/**
 * Reads the gifty_sid cookie, or mints a new one (httpOnly, Secure,
 * SameSite=Lax, 30-day lifetime) and writes it via the given cookie jar.
 * This id is the server's own handle on "which browser session is this" —
 * unlike the old existingOrder/existingOrderSignature fields, it isn't
 * something the client can omit or overwrite the meaning of; it can only
 * replay its own cookie, which just continues its own session.
 */
export function getOrCreateSessionId(cookieJar: CookieJar): string {
  const existing = cookieJar.get(SESSION_COOKIE_NAME)?.value;
  if (existing) return existing;

  const id = crypto.randomUUID();
  cookieJar.set(SESSION_COOKIE_NAME, id, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
  return id;
}

function orderKey(sessionId: string, signature: string): string {
  return `order:${sessionId}:${hashString(signature)}`;
}

function lockKey(sessionId: string, signature: string): string {
  return `order-lock:${sessionId}:${hashString(signature)}`;
}

/**
 * Looks up whether an order already exists for this exact
 * session+cart/address/recipient/date signature.
 *
 * IMPORTANT — documented limitation: this store is TTL-based (7 days), not
 * a permanent audit log. A `null` result means one of two things, and this
 * function cannot tell them apart:
 *   (a) an order for this signature was genuinely never created, or
 *   (b) one WAS created, but it happened more than ORDER_TTL_SECONDS ago
 *       and the record has since expired out of Redis.
 * We accept (b) as a conscious tradeoff: after 7 days, a resumed cart is
 * treated as a fresh checkout rather than risking an unbounded audit trail.
 * Callers MUST treat a `null` result as "safe to create" and MUST log
 * distinctly when they do so a human can grep for the ambiguous case if
 * duplicate orders are ever reported — see the call site in
 * app/api/chat/route.ts. If this risk profile ever needs tightening (e.g.
 * compliance requirements), replace this with a permanent store (Postgres)
 * instead of raising the TTL indefinitely.
 */
export async function getExistingOrder(
  redis: RedisLike,
  sessionId: string,
  signature: string
): Promise<Order | null> {
  const record = await redis.get<OrderRecord>(orderKey(sessionId, signature));
  return record?.order ?? null;
}

export async function saveOrder(
  redis: RedisLike,
  sessionId: string,
  signature: string,
  order: Order
): Promise<void> {
  const record: OrderRecord = { order, createdAt: Date.now() };
  await redis.set(orderKey(sessionId, signature), record, { ex: ORDER_TTL_SECONDS });
}

/**
 * Tries to become the sole owner of order-creation for this
 * session+signature. Returns false if another in-flight request already
 * holds it (e.g. a double-click or client retry) — the caller should NOT
 * proceed to createOrder() in that case.
 */
export async function acquireLock(
  redis: RedisLike,
  sessionId: string,
  signature: string
): Promise<boolean> {
  const result = await redis.set(lockKey(sessionId, signature), "1", {
    nx: true,
    ex: LOCK_TTL_SECONDS,
  });
  return result === "OK";
}

/**
 * Releases the lock. Callers must only call this if acquireLock() returned
 * true for them, and must call it in a `finally` block so a failed/thrown
 * createOrder() doesn't leave the signature soft-locked until TTL expiry.
 */
export async function releaseLock(
  redis: RedisLike,
  sessionId: string,
  signature: string
): Promise<void> {
  await redis.del(lockKey(sessionId, signature));
}
