import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { getPlaybookBySlug } from "@/lib/os-playbooks";

export const dynamic = "force-dynamic";

/** Playbooks are flat files under docs/ — basename only, no traversal. */
const SAFE_PLAYBOOK_FILE = /^playbook-[a-z0-9][a-z0-9._-]*\.md$/i;

function safeResolvedMarkdownPath(fileName: string): string | null {
  if (!SAFE_PLAYBOOK_FILE.test(fileName)) return null;
  const base = path.resolve(process.cwd(), "docs");
  const full = path.resolve(base, fileName);
  const rel = path.relative(base, full);
  if (rel.startsWith("..") || path.isAbsolute(rel)) return null;
  return full;
}

/**
 * GET — playbook markdown + meta for authenticated `/os` session (middleware protects `/api/os`).
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> }
) {
  const { slug } = await ctx.params;
  const meta = getPlaybookBySlug(slug);
  if (!meta) {
    return NextResponse.json({ error: "Unknown playbook" }, { status: 404 });
  }
  const diskPath = safeResolvedMarkdownPath(meta.fileName);
  if (!diskPath) {
    return NextResponse.json({ error: "Invalid playbook path" }, { status: 400 });
  }
  try {
    const markdown = await readFile(diskPath, "utf8");
    return NextResponse.json(
      { markdown, meta },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json({ error: "Playbook file missing" }, { status: 404 });
  }
}
