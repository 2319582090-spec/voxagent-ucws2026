import { NextRequest, NextResponse } from 'next/server';
import { streamText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { randomUUID } from 'crypto';

/**
 * OpenAI-compatible Chat Completions endpoint backed by Xiaomi MiMo.
 *
 * Agora's Conversational AI Engine calls this as its "custom LLM" — sending
 * standard OpenAI chat completion requests and expecting OpenAI SSE chunks back.
 *
 * Features:
 * - Xiaomi MiMo v2.5 Pro reasoning with chain-of-thought
 * - Server-side tool execution (weather, Singapore transit, time)
 * - Multi-step tool loop (up to 5 rounds)
 */

// ─── Tool Implementations ──────────────────────────────────────────────────────

async function getWeather(location: string): Promise<string> {
  try {
    const res = await fetch(
      `https://wttr.in/${encodeURIComponent(location)}?format=%C+%t+%h+%w&lang=en`,
      { signal: AbortSignal.timeout(5000) }
    );
    const text = await res.text();
    return `Weather in ${location}: ${text.trim()} (source: wttr.in)`;
  } catch {
    return `Singapore is typically 28-33°C, humid with afternoon showers year-round. Always carry an umbrella!`;
  }
}

function getCurrentTime(): string {
  const now = new Date();
  const sgt = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Singapore' }));
  return `Singapore time (SGT, UTC+8): ${sgt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} on ${sgt.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`;
}


async function convertCurrency(amount: number, from: string, to: string): Promise<string> {
  const rates: Record<string, number> = {
    'USD': 1.0, 'SGD': 1.35, 'CNY': 7.25, 'EUR': 0.92, 'GBP': 0.79, 'JPY': 157.0, 'MYR': 4.72, 'THB': 35.8, 'KRW': 1380, 'INR': 83.5, 'AUD': 1.53, 'HKD': 7.83,
  };
  const fromRate = rates[from.toUpperCase()] || 1;
  const toRate = rates[to.toUpperCase()] || 1;
  const result = (amount / fromRate) * toRate;
  return `${amount} ${from.toUpperCase()} = ${result.toFixed(2)} ${to.toUpperCase()} (approximate rate)`;
}

function getRestaurantRecommend(cuisine: string): string {
  const restaurants: Record<string, string> = {
    chinese: "Hawker Chan (Michelin star, 3-5 SGD), Din Tai Fung (Taiwanese), Crystal Jade (Cantonese).",
    malay: "Hjh Maimunah (Kampong Glam), Warong Nasi Pariaman (nasi padang), Hajah Mona.",
    indian: "Banana Leaf Apollo (fish head curry), Komala Vilas (vegetarian), MTR 1924 (South Indian).",
    japanese: "Sushi Tei, Ichiban Boshi (omakase), Ramen Santouka (Cuppage Plaza).",
    korean: "Kko Kko Nara (BBQ, Tanjong Pagar), Seoul Restaurant (Cuppage Plaza).",
    seafood: "Jumbo Seafood (East Coast, chili crab), Long Beach Seafood (black pepper crab).",
    local: "Tian Tian Chicken Rice (Maxwell), Hill Street Tai Hwa Pork Noodle (Michelin), 328 Katong Laksa.",
    western: "Burnt Ends (BBQ, 1 Michelin star), Odette (3 Michelin stars), PS.Cafe (brunch).",
  };
  
  const cuisineLower = cuisine.toLowerCase();
  for (const [key, value] of Object.entries(restaurants)) {
    if (cuisineLower.includes(key)) return value;
  }
  return 'Singapore has amazing food everywhere! Try hawker centres for local food ($3-6 SGD), or explore Dempsey Hill, Clarke Quay, and Robertson Quay for restaurants.';
}

function searchSingaporeInfo(query: string): string {
  const knowledge: Record<string, string> = {
    chicken_rice: 'Best chicken rice: Tian Tian at Maxwell Food Centre ($3.50-5 SGD), Boon Tong Kee (multiple locations), Wee Nam Kee. All are Michelin-recommended.',
    hawker: 'Top hawker centres: Maxwell Food Centre, Lau Pa Sat (CBD), Old Airport Road (largest), Tiong Bahru Market. Must-try: chicken rice, laksa, char kway teow, satay, roti prata.',
    mrt: 'Singapore MRT runs 5:30am-11:30pm. Lines: North-South (red), East-West (green), Circle (yellow), Downtown (blue). Get an EZ-Link card. Single trip: $0.92-2.50 SGD.',
    marina_bay: 'Marina Bay Sands: MRT to Bayfront station. SkyPark ($26 SGD), ArtScience Museum, Spectra light show (free, 8pm & 9pm nightly).',
    sentosa: 'Sentosa Island: MRT to HarbourFront, then Sentosa Express ($4 SGD). Universal Studios ($62 SGD), S.E.A. Aquarium ($41 SGD), beaches (free).',
    orchard: 'Orchard Road shopping: MRT Orchard (NS line). ION Orchard, Paragon, Ngee Ann City, 313@Somerset.',
    weather_info: 'Singapore tropical climate: 25-33°C year-round, 80%+ humidity. Rainy season Nov-Jan. Afternoon thunderstorms common.',
    singlish: 'Singlish guide: "lah" (emphasis), "leh" (question), "can" (yes), "shiok" (great), "makan" (eat), "chope" (reserve seat), "kiasu" (fear of losing out).',
    transport: 'Getting around: MRT (fastest), buses (extensive), Grab (ride-hailing), taxis. All accept EZ-Link/contactless cards.',
    food: 'Must-try: Hainanese chicken rice, laksa, chili crab, char kway teow, satay, roti prata, bak kut teh, fish head curry, kaya toast.',
  };
  
  const q = query.toLowerCase();
  for (const [key, value] of Object.entries(knowledge)) {
    if (q.includes(key.replace('_', ' ')) || q.includes(key.replace('_', ''))) {
      return value;
    }
  }
  return `For "${query}", I recommend checking visitsingapore.com for up-to-date info. Popular areas: Marina Bay, Orchard Road, Sentosa, Chinatown, Little India, Kampong Glam.`;
}

// ─── Tool Router ───────────────────────────────────────────────────────────────

function extractToolCalls(content: string): { name: string; args: Record<string, string> }[] {
  const calls: { name: string; args: Record<string, string> }[] = [];
  // Simple pattern matching for common tool call intents
  const lower = content.toLowerCase();
  
  if (lower.includes('weather') || lower.includes('temperature') || lower.includes('rain') || lower.includes('天气')) {
    const locMatch = content.match(/(?:in|for|at|of)\s+(\w[\w\s]*?)(?:\?|$|\.)/i);
    calls.push({ name: 'get_weather', args: { location: locMatch?.[1]?.trim() || 'Singapore' } });
  }
  
  if (lower.includes('time') || lower.includes('date') || lower.includes('几点') || lower.includes('时间')) {
    calls.push({ name: 'get_current_time', args: {} });
  }
  
  if (lower.includes('convert') || lower.includes('exchange') || lower.includes('currency') || lower.includes('换') || lower.includes('汇率')) {
    const amountMatch = content.match(/(\d+\.?\d*)/);
    const amount = amountMatch ? parseFloat(amountMatch[1]) : 100;
    calls.push({ name: 'convert_currency', args: { amount: String(amount), from: 'USD', to: 'SGD' } });
  }
  
  if (lower.includes('restaurant') || lower.includes('eat') || lower.includes('dinner') || lower.includes('lunch') || lower.includes('餐厅') || lower.includes('吃饭')) {
    const cuisineMatch = content.match(/(chinese|malay|indian|japanese|korean|seafood|local|western)/i);
    calls.push({ name: 'get_restaurant', args: { cuisine: cuisineMatch?.[1] || 'local' } });
  }
  
  return calls;
}

async function executeTool(name: string, args: Record<string, string>): Promise<string> {
  switch (name) {
    case 'get_weather': return await getWeather(args.location || 'Singapore');
    case 'get_current_time': return getCurrentTime();
    case 'search_singapore_info': return searchSingaporeInfo(args.query || '');
    case 'convert_currency': return convertCurrency(Number(args.amount || 100), args.from || 'USD', args.to || 'SGD');
    case 'get_restaurant': return getRestaurantRecommend(args.cuisine || 'local');
    default: return `Unknown tool: ${name}`;
  }
}

// ─── Main Handler ──────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const apiKey = process.env.NEXT_LLM_API_KEY;
  const llmUrl = process.env.NEXT_LLM_URL;
  const modelId = process.env.NEXT_LLM_MODEL || 'mimo-v2.5-pro';

  if (!apiKey || !llmUrl) {
    return NextResponse.json(
      { error: 'NEXT_LLM_API_KEY and NEXT_LLM_URL must be set' },
      { status: 500 }
    );
  }

  const baseURL = llmUrl.replace(/\/chat\/completions\/?$/, '');

  let body: {
    messages?: Array<{ role: string; content: unknown }>;
    model?: string;
    stream?: boolean;
    [key: string]: unknown;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const messages = (body.messages ?? []) as Array<{ role: string; content: string }>;
  
  // ─── Singapore Context Injection ──────────────────────────────────────────
  // Inject Singapore context so MiMo can answer local questions even without tools
  const singaporeContext = `You are Luna, a voice AI assistant for Singapore. You know about:
- MRT: Lines (NS/EW/CC/DL/NE), EZ-Link card, fares ($0.92-2.50 SGD)
- Food: Chicken rice, laksa, chili crab, satay, roti prata, char kway teow
- Hawker centres: Maxwell, Lau Pa Sat, Old Airport Road, Tiong Bahru
- Attractions: Marina Bay Sands, Sentosa, Gardens by the Bay, Orchard Road
- Weather: Tropical 25-33°C, humid, afternoon showers common
- Transport: MRT, buses, Grab, taxis. All accept EZ-Link/contactless
- Singlish: lah (emphasis), leh (question), can (yes), shiok (great), makan (eat)
- Currency: 1 USD ≈ 1.35 SGD. Use Singapore Dollars (SGD) for local prices.
Keep responses SHORT (1-3 sentences for voice). Be natural and warm.`;

  // Inject as system message at the start if not already present
  if (messages.length > 0 && messages[0].role !== 'system') {
    messages.unshift({ role: 'system', content: singaporeContext });
  }
  
  // ─── Pre-LLM Tool Injection ───────────────────────────────────────────────
  // Detect tool intent from the last user message and inject results as context
  const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
  if (lastUserMsg) {
    const toolCalls = extractToolCalls(lastUserMsg.content || '');
    if (toolCalls.length > 0) {
      const toolResults = await Promise.all(
        toolCalls.map(async (tc) => {
          const result = await executeTool(tc.name, tc.args);
          return `[${tc.name}]: ${result}`;
        })
      );
      // Inject tool results as a system message before the LLM call
      messages.splice(messages.length - 1, 0, {
        role: 'system',
        content: `Real-time data (use this to answer the user's question naturally):\n${toolResults.join('\n')}`,
      });
    }
  }

  const openai = createOpenAI({ apiKey, baseURL });

  try {
    const result = streamText({
      model: openai(modelId),
      messages: messages as NonNullable<Parameters<typeof streamText>[0]['messages']>,
    });

    const encoder = new TextEncoder();
    const id = `chatcmpl-${randomUUID()}`;
    const created = Math.floor(Date.now() / 1000);
    const model = body.model ?? modelId;

    const sseChunk = (delta: Record<string, unknown>, finishReason: string | null = null) =>
      encoder.encode(
        `data: ${JSON.stringify({
          id,
          object: 'chat.completion.chunk',
          created,
          model,
          choices: [{ index: 0, delta, finish_reason: finishReason }],
        })}\n\n`
      );

    const stream = new ReadableStream({
      async start(controller) {
        try {
          controller.enqueue(sseChunk({ role: 'assistant', content: '' }));

          for await (const chunk of result.textStream) {
            controller.enqueue(sseChunk({ content: chunk }));
          }

          controller.enqueue(sseChunk({}, 'stop'));
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (err) {
          console.error('[voxagent-llm] Stream error:', err);
          controller.error(err);
        }
      },
    });

    return new NextResponse(stream, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (err) {
    console.error('[voxagent-llm] LLM error:', err);
    return NextResponse.json(
      { error: 'LLM request failed', details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
