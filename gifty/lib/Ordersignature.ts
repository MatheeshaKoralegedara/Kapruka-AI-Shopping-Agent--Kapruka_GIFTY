/**
 * Produces a stable string fingerprint of the cart + delivery details.
 * Used to detect whether an order already exists for the *current* state
 * of the cart, so we never call createOrder() twice for the same order —
 * even if the model re-emits [CREATE_ORDER] on a later turn (e.g. when the
 * user just asks "give me order details" and the model gets confused about
 * whether checkout already happened).
 *
 * If the cart, address, recipient, or delivery date changes, the signature
 * changes too — which correctly allows a *new* order to be created.
 */
export function computeCartSignature(input: {
  cart?: Array<{ id: string; quantity: number }>;
  address?: string;
  recipientName?: string;
  recipientPhone?: string;
  deliveryDate?: string;
}): string {
  const cartPart = (input.cart || [])
    .map((i) => `${i.id}:${i.quantity}`)
    .sort()
    .join(",");

  return [
    cartPart,
    input.address?.trim() || "",
    input.recipientName?.trim() || "",
    input.recipientPhone?.trim() || "",
    input.deliveryDate?.trim() || "",
  ].join("|");
}