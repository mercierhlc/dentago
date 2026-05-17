import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { logEvent } from "@/lib/events";
import type { EventType } from "@/lib/events";

export const runtime = "nodejs";

function safeEqualHexOrString(a: string, b: string): boolean {
  try {
    if (a.length !== b.length) return false;
    return timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
  } catch {
    return false;
  }
}

function vercelSignatureOk(rawBody: string, secret: string, headerSig: string | null): boolean {
  if (!headerSig) return false;
  const digest = createHmac("sha1", secret).update(rawBody).digest("hex");
  return safeEqualHexOrString(digest, headerSig);
}

function mapVercelEventType(vercelType: string): EventType {
  if (vercelType === "deployment.succeeded" || vercelType === "deployment.ready" || vercelType === "deployment.promoted")
    return "production_deploy";
  if (vercelType === "deployment.error" || vercelType === "deployment.failed" || vercelType === "deployment.canceled")
    return "deployment_failed";
  return "deployment_event";
}

/**
 * Vercel deployment webhooks (signed) or manual deploy log (Bearer secret).
 *
 * Vercel: set Project → Webhooks → URL `https://www.dentago.co.uk/api/webhooks/vercel-deployment`
 * and env `VERCEL_WEBHOOK_SECRET` to the signing secret Vercel shows once.
 *
 * Manual / CI after `vercel --prod`:
 *   curl -X POST https://www.dentago.co.uk/api/webhooks/vercel-deployment \
 *     -H "Authorization: Bearer $DEPLOY_LOG_SECRET" \
 *     -H "Content-Type: application/json" \
 *     -d '{"note":"CLI deploy","deployment_url":"https://…","target":"production"}'
 * Set `DEPLOY_LOG_SECRET` in Vercel env (or reuse `CRON_SECRET`).
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const vercelSecret = process.env.VERCEL_WEBHOOK_SECRET;
  const deployLogSecret = process.env.DEPLOY_LOG_SECRET ?? process.env.CRON_SECRET;
  const sigHeader = request.headers.get("x-vercel-signature");
  const auth = request.headers.get("authorization");

  let fromVercel = false;
  if (vercelSecret && sigHeader) {
    if (!vercelSignatureOk(rawBody, vercelSecret, sigHeader)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
    fromVercel = true;
  } else if (auth === `Bearer ${deployLogSecret}` && deployLogSecret) {
    // manual / script
  } else {
    return NextResponse.json(
      { error: "Unauthorized — configure VERCEL_WEBHOOK_SECRET (Vercel) or Bearer DEPLOY_LOG_SECRET / CRON_SECRET" },
      { status: 401 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (fromVercel && body.type && body.payload && typeof body.payload === "object") {
    const vercelType = String(body.type);
    const payload = body.payload as Record<string, unknown>;
    const deployment = (payload.deployment as Record<string, unknown>) ?? {};
    const project = (payload.project as Record<string, unknown>) ?? {};
    const target = payload.target != null ? String(payload.target) : "";
    const url = deployment.url != null ? String(deployment.url) : "";
    const depId = deployment.id != null ? String(deployment.id) : "";
    const projectName = project.name != null ? String(project.name) : "";

    const eventType = mapVercelEventType(vercelType);
    const summaryLines =
      eventType === "production_deploy"
        ? [
            "A production (or promoted) deployment finished successfully on Vercel.",
            projectName ? `Project: ${projectName}.` : "",
            target ? `Target: ${target}.` : "",
            url ? `Deployed URL snapshot: ${url}.` : "",
            "This row exists so /os Events shows releases to people and to AI without digging in Vercel.",
          ].filter(Boolean)
        : eventType === "deployment_failed"
          ? [
              "Vercel reported a failed or canceled deployment.",
              projectName ? `Project: ${projectName}.` : "",
              target ? `Target: ${target}.` : "",
              "Check the Vercel deployment inspector for build logs.",
            ].filter(Boolean)
          : [
              `Vercel webhook: ${vercelType}.`,
              projectName ? `Project: ${projectName}.` : "",
              target ? `Target: ${target}.` : "",
            ].filter(Boolean);

    await logEvent({
      event_type: eventType,
      entity_type: "deployment",
      entity_id: depId || String(body.id ?? "unknown"),
      payload: {
        vercel_event_type: vercelType,
        deployment_id: depId || null,
        deployment_url: url || null,
        project_name: projectName || null,
        target: target || null,
        inspector_hint: url ? url : depId ? `Look up deployment id ${depId} in Vercel` : null,
        summary_lines: summaryLines,
      },
      source: "vercel_webhook",
    });

    return NextResponse.json({ ok: true, logged: eventType });
  }

  /* Manual payload */
  const note = typeof body.note === "string" ? body.note : "Deploy logged manually";
  const deploymentUrl = typeof body.deployment_url === "string" ? body.deployment_url : "";
  const target = typeof body.target === "string" ? body.target : "production";
  const gitSha = typeof body.git_sha === "string" ? body.git_sha : "";

  const summaryLines = [
    note,
    deploymentUrl ? `Deployment URL: ${deploymentUrl}` : "",
    gitSha ? `Git SHA: ${gitSha}` : "",
    "Logged via authenticated POST (CLI, CI, or internal tool)—not necessarily a Vercel signed webhook.",
  ].filter(Boolean);

  await logEvent({
    event_type: "production_deploy",
    entity_type: "deployment",
    entity_id: gitSha || deploymentUrl || "manual",
    payload: {
      deployment_url: deploymentUrl || null,
      target,
      git_sha: gitSha || null,
      summary_lines: summaryLines,
    },
    source: "deploy_log_manual",
  });

  return NextResponse.json({ ok: true, logged: "production_deploy" });
}
