import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { supabaseAdmin } from "@/lib/supabase";
import { logEvent } from "@/lib/events";

/** Allowed slugs map to public/os/{slug}.md on disk when DB row is empty */
const ALLOWED = new Set(["OS-DOCTRINE"]);

export const dynamic = "force-dynamic";

function fallbackPath(slug: string) {
  return join(process.cwd(), "public", "os", `${slug}.md`);
}

function checkOsCookie(req: Request) {
  const raw = req.headers.get("cookie") ?? "";
  const ok =
    raw.includes("os-auth=dentago-os-8a76d2a0") ||
    raw.match(/(?:^|;\s*)os-auth=dentago-os-8a76d2a0(?:;|$)/);
  return !!ok;
}

/**
 * GET — markdown body. Updates in os_live_documents reflect immediately (no redeploy).
 * Query ?format=json returns { body_md, source: "db"|"disk" }.
 */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ slug: string }> }
) {
  const { slug } = await ctx.params;
  if (!ALLOWED.has(slug)) {
    return NextResponse.json({ error: "Unknown document" }, { status: 404 });
  }

  const { data: row, error: dbErr } = await supabaseAdmin
    .from("os_live_documents")
    .select("body_md")
    .eq("slug", slug)
    .maybeSingle();

  const fromDb =
    !dbErr && typeof row?.body_md === "string" ? row.body_md.trim() : "";
  let body = fromDb;
  let source: "db" | "disk" = "db";

  if (!body) {
    const fp = fallbackPath(slug);
    if (!existsSync(fp)) {
      return NextResponse.json({ error: "No document on disk or DB" }, { status: 404 });
    }
    body = readFileSync(fp, "utf8");
    source = "disk";
  }

  const { searchParams } = new URL(req.url);
  if (searchParams.get("format") === "json") {
    return NextResponse.json(
      { slug, body_md: body, source },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
    },
  });
}

/**
 * PUT — replace markdown in DB (requires OS cookie). Takes effect on next GET without redeploy.
 */
export async function PUT(
  req: Request,
  ctx: { params: Promise<{ slug: string }> }
) {
  if (!checkOsCookie(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug } = await ctx.params;
  if (!ALLOWED.has(slug)) {
    return NextResponse.json({ error: "Unknown document" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const body_md = typeof body?.body_md === "string" ? body.body_md : null;
  if (body_md === null) {
    return NextResponse.json({ error: "body_md string required" }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from("os_live_documents").upsert(
    { slug, body_md, updated_at: new Date().toISOString() },
    { onConflict: "slug" }
  );

  if (error) {
    const hint =
      error.message.includes("relation") || error.message.includes("does not exist")
        ? " Apply migration supabase/migrations/20260506_os_live_documents.sql"
        : "";
    return NextResponse.json({ error: error.message + hint }, { status: 500 });
  }

  await logEvent({
    event_type: "os_live_doc_updated",
    entity_type: "os_live_document",
    entity_id: slug,
    payload: {
      slug,
      body_chars: body_md.length,
      summary_lines: [
        `Live OS markdown updated: ${slug}`,
        "Served immediately from Supabase (GET /api/os/live-doc) — no redeploy required for this text.",
      ],
    },
    source: "api_os_live_doc",
  });

  return NextResponse.json({ ok: true, slug });
}
