import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getDb } from "@/lib/db/sqlite";
import { emailTemplate } from "@/lib/db/schema";

export async function GET(request: Request) {
  const db = getDb();
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (id) {
      const row = db.select().from(emailTemplate).where(eq(emailTemplate.id, id)).get();
      if (!row) return NextResponse.json({ error: "Template not found" }, { status: 404 });
      return NextResponse.json(row);
    }
    const rows = db.select().from(emailTemplate).all();
    return NextResponse.json(rows);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const db = getDb();
  try {
    const body = (await request.json()) as {
      id?: string;
      subject?: unknown;
      content?: unknown;
    };
    const subject = typeof body.subject === "string" ? body.subject.trim() : "";
    const content = typeof body.content === "string" ? body.content.trim() : "";
    if (!subject || !content) {
      return NextResponse.json({ error: "subject and content are required" }, { status: 400 });
    }
    const id = body.id && typeof body.id === "string" && body.id.trim() ? body.id.trim() : randomUUID();
    const now = Date.now();
    db.insert(emailTemplate)
      .values({
        id,
        subject,
        content,
        createdAt: now,
        updatedAt: now,
      })
      .run();
    const row = db.select().from(emailTemplate).where(eq(emailTemplate.id, id)).get();
    return NextResponse.json(row, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const db = getDb();
  try {
    const body = (await request.json()) as {
      id?: unknown;
      subject?: unknown;
      content?: unknown;
    };
    const id = typeof body.id === "string" && body.id.trim() ? body.id.trim() : "";
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
    const patch: Record<string, any> = {};
    if (typeof body.subject === "string") patch.subject = body.subject.trim();
    if (typeof body.content === "string") patch.content = body.content.trim();
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }
    patch.updatedAt = Date.now();
    db.update(emailTemplate).set(patch).where(eq(emailTemplate.id, id)).run();
    const row = db.select().from(emailTemplate).where(eq(emailTemplate.id, id)).get();
    if (!row) return NextResponse.json({ error: "Template not found" }, { status: 404 });
    return NextResponse.json(row);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const db = getDb();
  try {
    const url = new URL(request.url);
    const idFromQuery = url.searchParams.get("id");
    let id = idFromQuery;
    if (!id) {
      const body = await request.json().catch(() => null);
      if (body && typeof body.id === "string") id = body.id;
    }
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
    db.delete(emailTemplate).where(eq(emailTemplate.id, id)).run();
    return NextResponse.json({ success: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

