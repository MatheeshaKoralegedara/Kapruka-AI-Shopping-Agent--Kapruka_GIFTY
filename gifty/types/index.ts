export interface Product {
  id: string;
  name: string;
  price: number;
  image: string;
  url?: string;
  desc?: string;
  category?: string;
}

export interface CartItem extends Product {
  quantity: number;
}

export interface Order {
  payLink: string;
  orderId: string;
  total: number;
  deliveryDate?: string;
}

export interface DeliveryQuote {
  cost: number;
  estimatedDate: string;
  available: boolean;
}

export type MessageRole = "user" | "assistant";

export type Language = "en" | "si" | "ta" | "tanglish";

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  products?: Product[];
  order?: Order;
  deliveryQuote?: DeliveryQuote;
  timestamp: Date;
  language?: Language;
}

export interface SessionData {
  cart: CartItem[];
  address?: string;
  recipientName?: string;
  recipientPhone?: string;
  deliveryDate?: string;
  deliveryTime?: string;
  giftNote?: string;
}

export interface ChatRequest {
  messages: { role: MessageRole; content: string }[];
  sessionData: SessionData;
}

export interface ChatResponse {
  text: string;
  products?: Product[];
  order?: Order;
  deliveryQuote?: DeliveryQuote;
  error?: string;
}
