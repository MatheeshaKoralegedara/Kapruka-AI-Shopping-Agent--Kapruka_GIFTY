# GIFTY — Kapruka Shopping Agent

AI-powered conversational shopping agent for Kapruka. Built for the Kapruka Agent Challenge 2026.

## Features

- Full-screen chat UI with Night Market dark aesthetic
- Multilingual: English, සිංහල, Tamil, Tanglish
- Real product search via Kapruka MCP
- Horizontal product carousels with images
- Conversational checkout — no forms
- Persistent cart with live totals
- Animated typing indicators
- Gift mode with occasion-aware recommendations

## Tech Stack

- **Next.js 14** (App Router)
- **TypeScript**
- **Framer Motion** (animations)
- **Zustand** (cart/session state)
- **Claude claude-sonnet-4-20250514** (AI brain)
- **Kapruka MCP** (mcp.kapruka.com/mcp)
- **Vercel** (deployment)

## Setup

```bash
# 1. Clone and install
git clone <your-repo>
cd gifty
npm install

# 2. Set up environment
cp .env.example .env.local
# Edit .env.local and add your Anthropic API key

# 3. Run locally
npm run dev
# Open http://localhost:3000
```

## Environment Variables

| Variable | Description |
|---|---|
| `ANTHROPIC_API_KEY` | Your Anthropic API key from console.anthropic.com |

## Project Structure

```
app/
  page.tsx              # Full-screen chat shell
  layout.tsx            # HTML layout + metadata
  api/
    chat/route.ts       # Claude API + MCP integration
components/
  ChatBubble.tsx        # Message bubbles + typing indicator
  ProductCard.tsx       # Product cards + carousel
  CartPill.tsx          # Persistent cart bar
  OrderConfirmation.tsx # Green order success state
lib/
  kapruka.ts            # Kapruka MCP wrapper
  prompt.ts             # Claude system prompt
  session.ts            # Zustand store (cart, address)
  i18n.ts               # Language detection
types/
  index.ts              # TypeScript interfaces
```

## Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set environment variable in Vercel dashboard:
# ANTHROPIC_API_KEY = sk-ant-...
```

Or connect your GitHub repo to Vercel for automatic deploys on push.

## MCP Integration

The app calls `https://mcp.kapruka.com/mcp` server-side from the API route.
No API key required — it's free and public.

Available tools:
- `search_products` — search catalog
- `get_categories` — browse categories  
- `quote_delivery` — delivery cost + ETA to any Sri Lankan address
- `create_order` — create guest checkout order, returns pay link
- `track_order` — track existing order by ID

## Customisation

- **System prompt**: Edit `lib/prompt.ts` to change GIFTY's personality
- **Colors**: All CSS vars in `app/page.tsx` — change `#ff6b35` for a different accent
- **Languages**: Extend `lib/i18n.ts` for more language patterns
- **Welcome message**: Change `WELCOME_MESSAGE` in `app/page.tsx`
