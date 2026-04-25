import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(request: Request) {
  const { name, practice, email, phone } = await request.json();

  if (!name || !practice || !email) {
    return NextResponse.json({ error: "name, practice and email are required" }, { status: 400 });
  }

  // Save to Supabase leads table
  const { error } = await supabaseAdmin.from("leads").insert({
    name,
    practice,
    email,
    phone: phone || null,
    source: request.headers.get("referer") ?? "direct",
  });

  if (error) {
    console.error("Lead insert error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Email notification to Mercier via Resend
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Dentago Leads <leads@dentago.co.uk>",
        to: "mercier@dentago.co.uk",
        subject: `New lead: ${name} — ${practice}`,
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
            <h2 style="color:#6C3DE8;margin:0 0 16px">New Dentago Lead</h2>
            <table style="width:100%;border-collapse:collapse">
              <tr><td style="padding:8px 0;color:#666;font-size:14px">Name</td><td style="padding:8px 0;font-weight:600;font-size:14px">${name}</td></tr>
              <tr><td style="padding:8px 0;color:#666;font-size:14px">Practice</td><td style="padding:8px 0;font-weight:600;font-size:14px">${practice}</td></tr>
              <tr><td style="padding:8px 0;color:#666;font-size:14px">Email</td><td style="padding:8px 0;font-weight:600;font-size:14px"><a href="mailto:${email}">${email}</a></td></tr>
              <tr><td style="padding:8px 0;color:#666;font-size:14px">Phone</td><td style="padding:8px 0;font-weight:600;font-size:14px">${phone || "—"}</td></tr>
            </table>
            <a href="mailto:${email}" style="display:inline-block;margin-top:20px;background:#6C3DE8;color:white;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px">Reply to ${name}</a>
          </div>
        `,
      }),
    });
  } catch {
    // Non-fatal — lead is saved, email notification is best-effort
  }

  return NextResponse.json({ success: true }, { status: 201 });
}
