import { NextResponse } from "next/server";

const DEFAULT_AUDIO_MODEL = "whisper-1";

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    const apiKeyRaw = form.get("apiKey");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing audio file." }, { status: 400 });
    }

    const apiKeyFromClient =
      typeof apiKeyRaw === "string" ? apiKeyRaw.trim() : "";
    const envKey = process.env.OPENAI_API_KEY?.trim() || "";
    const key = envKey || apiKeyFromClient;

    if (!key) {
      return NextResponse.json(
        {
          error:
            "No OpenAI API key available. Set OPENAI_API_KEY in .env.local on the server, or paste a key in Settings.",
        },
        { status: 400 },
      );
    }

    const upstream = new FormData();
    upstream.append("file", file);
    upstream.append(
      "model",
      process.env.OPENAI_AUDIO_MODEL?.trim() || DEFAULT_AUDIO_MODEL,
    );

    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
      },
      body: upstream,
    });

    const data = (await res.json()) as {
      text?: string;
      error?: { message?: string };
    };

    if (!res.ok) {
      const message =
        data.error?.message ||
        `Audio transcription failed (${res.status}).`;
      return NextResponse.json({ error: message }, { status: res.status === 401 ? 401 : 502 });
    }

    const transcript = data.text?.trim() || "";
    if (!transcript) {
      return NextResponse.json(
        { error: "Transcription returned empty text." },
        { status: 502 },
      );
    }

    return NextResponse.json({ transcript });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unexpected server error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
