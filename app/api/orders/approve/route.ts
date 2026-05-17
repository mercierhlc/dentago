/**
 * POST /api/orders/approve
 * Approve or reject an order that is pending_approval.
 * Only a clinic manager or owner may approve.
 */
import { NextResponse } from "next/server";
import { Resend } from "resend";
import { supabaseAdmin } from "@/lib/supabase";
import { logEvent } from "@/lib/events";

const resend = new Resend(process.env.RESEND_API_KEY);

async function getClinicUser(token: string) {
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;

  // Check primary clinic owner
  const { data: primaryClinic } = await supabaseAdmin
    .from("clinic_accounts")
    .select("id, clinic_name")
    .eq("auth_user_id", user.id)
    .single();

  if (primaryClinic) {
    return { user, clinicId: primaryClinic.id, clinicName: primaryClinic.clinic_name, role: "owner" as const };
  }

  // Check clinic_users (staff/manager)
  const { data: clinicUser } = await supabaseAdmin
    .from("clinic_users")
    .select("clinic_id, role, clinic_accounts(clinic_name)")
    .eq("auth_user_id", user.id)
    .single();

  if (clinicUser) {
    return {
      user,
      clinicId: clinicUser.clinic_id,
      clinicName: (clinicUser.clinic_accounts as any)?.clinic_name ?? "",
      role: clinicUser.role as "manager" | "staff",
    };
  }

  return null;
}

export async function POST(request: Request) {
  try {
    const token = request.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

    const clinicUser = await getClinicUser(token);
    if (!clinicUser) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

    const { orderId, action, notes } = await request.json();
    if (!orderId || !["approved", "rejected"].includes(action)) {
      return NextResponse.json({ error: "orderId and action (approved|rejected) are required" }, { status: 400 });
    }

    // Only managers and owners can approve
    if (clinicUser.role === "staff") {
      return NextResponse.json({ error: "Only managers or owners can approve orders" }, { status: 403 });
    }

    // Fetch the order — must belong to this clinic and be pending_approval
    const { data: order, error: fetchErr } = await supabaseAdmin
      .from("dentago_orders")
      .select("id, clinic_name, clinic_email, total_amount, approval_status, clinic_id")
      .eq("id", orderId)
      .eq("clinic_id", clinicUser.clinicId)
      .single();

    if (fetchErr || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (order.approval_status !== "pending_approval") {
      return NextResponse.json(
        { error: `Order is not pending approval (current status: ${order.approval_status})` },
        { status: 409 }
      );
    }

    // Update the order
    const now = new Date().toISOString();
    const newOrderStatus = action === "approved" ? "pending" : "cancelled";

    await supabaseAdmin
      .from("dentago_orders")
      .update({
        approval_status: action,
        approved_by: clinicUser.user.id,
        approved_at: now,
        approval_notes: notes ?? null,
        // If approved → move to pending (ops processes it); if rejected → cancel
        status: newOrderStatus,
        updated_at: now,
      })
      .eq("id", orderId);

    // Write audit log
    await supabaseAdmin.from("order_approvals").insert({
      order_id: orderId,
      action,
      actor_user_id: clinicUser.user.id,
      actor_email: clinicUser.user.email,
      notes: notes ?? null,
    });

    // Notify the clinic submitter by email
    if (order.clinic_email && process.env.RESEND_API_KEY) {
      const isApproved = action === "approved";
      const subject = isApproved
        ? `Order approved — Ref: ${orderId.slice(0, 8).toUpperCase()}`
        : `Order rejected — Ref: ${orderId.slice(0, 8).toUpperCase()}`;

      const html = `
        <div style="font-family:'Helvetica Neue',sans-serif;max-width:520px;margin:0 auto;padding:48px 24px;">
          <div style="font-size:24px;font-weight:800;color:#111111;margin-bottom:28px;">Dentago</div>
          <h2 style="font-size:20px;font-weight:800;color:#151121;margin:0 0 12px;">
            Order ${isApproved ? "Approved" : "Rejected"}
          </h2>
          <p style="color:#64748b;font-size:15px;line-height:1.7;margin:0 0 24px;">
            Hi ${order.clinic_name}, your order
            <strong style="font-family:monospace;color:#111111;">${orderId.slice(0, 8).toUpperCase()}</strong>
            (£${Number(order.total_amount).toFixed(2)}) has been
            <strong>${isApproved ? "approved and sent to your supplier" : "rejected"}</strong>.
          </p>
          ${notes ? `<p style="color:#64748b;font-size:14px;"><strong>Notes:</strong> ${notes}</p>` : ""}
          ${!isApproved ? `<p style="color:#64748b;font-size:14px;">Please contact your manager if you have questions.</p>` : ""}
          <p style="color:#94a3b8;font-size:12px;margin-top:40px;border-top:1px solid #f1f5f9;padding-top:24px;">
            Dentago Ltd · <a href="mailto:support@dentago.co.uk" style="color:#111111;">support@dentago.co.uk</a>
          </p>
        </div>`;

      await resend.emails.send({
        from: "Dentago <support@dentago.co.uk>",
        to: order.clinic_email,
        subject,
        html,
      }).catch(err => console.error("Approval notification email error:", err));
    }

    // Log event
    await logEvent({
      event_type: action === "approved" ? "order_approved" : "order_rejected",
      entity_type: "clinic",
      entity_id: clinicUser.clinicId,
      payload: {
        order_id: orderId,
        action,
        approved_by: clinicUser.user.email,
        clinic_name: order.clinic_name,
        total_amount: order.total_amount,
      },
      metrics: { order_value: parseFloat(order.total_amount) },
      source: "orders_approve_api",
    });

    return NextResponse.json({ success: true, action, orderId });

  } catch (err) {
    console.error("Approve order error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// GET /api/orders/approve?clinicId=... — list orders pending approval for this clinic
export async function GET(request: Request) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const clinicUser = await getClinicUser(token);
  if (!clinicUser) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  if (clinicUser.role === "staff") {
    return NextResponse.json({ error: "Managers only" }, { status: 403 });
  }

  const { data: orders, error } = await supabaseAdmin
    .from("dentago_orders")
    .select("id, clinic_name, clinic_email, total_amount, notes, created_at, approval_status, approval_notes, approved_at")
    .eq("clinic_id", clinicUser.clinicId)
    .eq("approval_status", "pending_approval")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ orders: orders ?? [], clinicId: clinicUser.clinicId });
}
