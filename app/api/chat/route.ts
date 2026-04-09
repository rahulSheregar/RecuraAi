import { NextResponse } from "next/server";

type ChatMessage = { role: "user" | "assistant" | "system"; content: string };

const DEFAULT_MODEL = "gpt-4o-mini";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      messages?: unknown;
      apiKey?: unknown;
      systemPrompt?: unknown;
    };

    const apiKeyFromClient =
      typeof body.apiKey === "string" ? body.apiKey.trim() : "";
    const key = apiKeyFromClient || process.env.OPENAI_API_KEY?.trim() || "";

    if (!key) {
      return NextResponse.json(
        {
          error:
            "No OpenAI API key available. Set OPENAI_API_KEY in .env.local on the server, or paste a key in Settings (kept in memory for this session only).",
        },
        { status: 400 },
      );
    }

    const rawMessages = body.messages;
    if (!Array.isArray(rawMessages) || rawMessages.length === 0) {
      return NextResponse.json(
        { error: "Request must include a non-empty messages array." },
        { status: 400 },
      );
    }

    const messages: ChatMessage[] = [];
    const systemPrompt =
      typeof body.systemPrompt === "string" ? body.systemPrompt.trim() : "";
    if (systemPrompt) {
      messages.push({ role: "system", content: systemPrompt });
    }

    for (const m of rawMessages) {
      if (!m || typeof m !== "object") continue;
      const role = (m as { role?: string }).role;
      const content = (m as { content?: string }).content;
      if (role !== "user" && role !== "assistant") continue;
      if (typeof content !== "string" || !content.trim()) continue;
      messages.push({ role, content: content.trim() });
    }

    if (messages.filter((m) => m.role !== "system").length === 0) {
      return NextResponse.json(
        { error: "No valid user or assistant messages." },
        { status: 400 },
      );
    }

    const model = process.env.OPENAI_MODEL?.trim() || DEFAULT_MODEL;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.7,
      }),
    });

    const data = (await res.json()) as {
      error?: { message?: string };
      choices?: { message?: { content?: string } }[];
    };

    if (!res.ok) {
      const msg =
        data.error?.message ||
        `OpenAI request failed (${res.status}). Check your key and model.`;
      return NextResponse.json({ error: msg }, { status: res.status === 401 ? 401 : 502 });
    }

    const text = data.choices?.[0]?.message?.content?.trim() || "";
    if (!text) {
      return NextResponse.json(
        { error: "Empty response from the model." },
        { status: 502 },
      );
    }

    return NextResponse.json({ message: text });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unexpected server error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
