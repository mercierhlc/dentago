import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from "@/lib/supabase";
import { requireAdminAuth } from "@/lib/admin-auth";

type ProfileRow = Record<string, unknown> & {
  id: string;
  created_at?: string;
  clinic_account_id?: string;
};

function syntheticProfileFromOrphanAccount(row: {
  auth_user_id: string;
  clinic_name: string | null;
  email: string | null;
  created_at: string;
}): ProfileRow {
  const name = (row.clinic_name ?? "").trim() || "Workspace";
  return {
    id: row.auth_user_id,
    practice_name: name,
    gdc_number: "",
    practice_type: "Not specified",
    street_address: "",
    city: "",
    postcode: "",
    phone: "",
    status: "pending",
    created_at: row.created_at,
    reviewed_at: null,
    rejection_reason: null,
    admin_notes: null,
    is_deactivated: false,
    application_email_sent: false,
  };
}

export async function GET(request: NextRequest) {
  const unauth = requireAdminAuth(request);
  if (unauth) return unauth;
  const { data: profiles, error } = await supabaseAdmin
    .from('clinic_profiles')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const profileIdSet = new Set((profiles ?? []).map((p: { id: string }) => p.id))

  const { data: accountsNoProfile } = await supabaseAdmin
    .from("clinic_accounts")
    .select("id, auth_user_id, clinic_name, email, created_at")
    .not("auth_user_id", "is", null);

  const orphanAccounts = (accountsNoProfile ?? []).filter(
    (row: { auth_user_id: string | null }) => Boolean(row.auth_user_id) && !profileIdSet.has(String(row.auth_user_id)),
  );

  const mergedProfiles: ProfileRow[] = [
    ...(profiles ?? []) as ProfileRow[],
    ...orphanAccounts.map((row: {
      id: string;
      auth_user_id: string;
      clinic_name: string | null;
      email: string | null;
      created_at: string;
    }) => ({
      ...syntheticProfileFromOrphanAccount(row),
      clinic_account_id: row.id,
    })),
  ];

  const userIds = mergedProfiles.map((p) => p.id);

  const accountByUserId = new Map<
    string,
    { clinic_account_id: string; onboarding_survey: unknown; onboarding_survey_at: string | null }
  >();
  if (userIds.length > 0) {
    const { data: accountRows, error: acctErr } = await supabaseAdmin
      .from("clinic_accounts")
      .select("id, auth_user_id, onboarding_survey, onboarding_survey_at")
      .in("auth_user_id", userIds);
    if (!acctErr && accountRows) {
      for (const r of accountRows as {
        id?: string;
        auth_user_id?: string;
        onboarding_survey?: unknown;
        onboarding_survey_at?: string | null;
      }[]) {
        const uid = r.auth_user_id;
        const cid = r.id;
        if (uid && cid) {
          accountByUserId.set(uid, {
            clinic_account_id: cid,
            onboarding_survey: r.onboarding_survey ?? null,
            onboarding_survey_at: r.onboarding_survey_at ?? null,
          });
        }
      }
    }
  }

  const { data: { users } } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })

  // Surface any auth user that has no clinic_profile AND no clinic_account yet
  const allKnownIds = new Set(mergedProfiles.map((p) => p.id));
  const authOnlyUsers = (users ?? []).filter((u) => u.email && !allKnownIds.has(u.id));
  for (const u of authOnlyUsers) {
    mergedProfiles.push({
      id: u.id,
      practice_name: u.user_metadata?.practice_name ?? u.email?.split("@")[0] ?? "—",
      gdc_number: "",
      practice_type: "Not specified",
      street_address: "",
      city: "",
      postcode: "",
      phone: "",
      status: "pending",
      created_at: u.created_at,
      reviewed_at: null,
      rejection_reason: null,
      admin_notes: null,
      is_deactivated: false,
      application_email_sent: false,
      _auth_only: true,
    } as ProfileRow);
  }
  mergedProfiles.sort((a, b) => {
    const ta = new Date(String(a.created_at ?? 0)).getTime();
    const tb = new Date(String(b.created_at ?? 0)).getTime();
    return tb - ta;
  });

  const { data: documents } = await supabaseAdmin.from('clinic_documents').select('*').in('user_id', userIds)
  const { data: connections } = await supabaseAdmin.from('supplier_connections').select('*').in('user_id', userIds)

  const combined = mergedProfiles.map((profile: ProfileRow) => {
    const acct = orphanAccounts.find((a: { auth_user_id: string }) => a.auth_user_id === profile.id);
    const emailFromAccount = acct && typeof acct.email === "string" && acct.email.trim() ? acct.email.trim() : null;
    const emailFromAuth = users?.find((u) => u.id === profile.id)?.email ?? null;
    const email = emailFromAccount ?? emailFromAuth ?? "—";
    const ob = accountByUserId.get(profile.id);
    const clinicAccountId =
      ob?.clinic_account_id ??
      (typeof (profile as { clinic_account_id?: string }).clinic_account_id === "string"
        ? (profile as { clinic_account_id: string }).clinic_account_id
        : null);
    return {
      ...profile,
      email,
      documents: (documents ?? []).filter((d: { user_id: string }) => d.user_id === profile.id),
      connections: (connections ?? []).filter((c: { user_id: string }) => c.user_id === profile.id),
      onboarding_survey: ob?.onboarding_survey ?? null,
      onboarding_survey_at: ob?.onboarding_survey_at ?? null,
      clinic_account_id: clinicAccountId,
    };
  })

  const clinicAccountIds = [
    ...new Set(
      combined
        .map((row: Record<string, unknown>) =>
          typeof row.clinic_account_id === "string" ? (row.clinic_account_id as string) : null,
        )
        .filter((x): x is string => Boolean(x)),
    ),
  ];
  const orderPlacedClinicIds = new Set<string>();
  if (clinicAccountIds.length > 0) {
    const { data: orderEvts } = await supabaseAdmin
      .from("events")
      .select("entity_id")
      .eq("event_type", "order_placed")
      .in("entity_id", clinicAccountIds);
    for (const e of orderEvts ?? []) {
      const eid = (e as { entity_id?: string }).entity_id;
      if (eid) orderPlacedClinicIds.add(eid);
    }
  }

  const combinedWithOrders = combined.map((row: Record<string, unknown>) => ({
    ...row,
    has_placed_order:
      typeof row.clinic_account_id === "string" ? orderPlacedClinicIds.has(row.clinic_account_id as string) : false,
  }));

  const emails = [...new Set(
    combinedWithOrders
      .map((row: Record<string, unknown>) => typeof row.email === 'string' && row.email !== '—' ? String(row.email).toLowerCase().trim() : null)
      .filter((e): e is string => Boolean(e))
  )]

  let marketingByEmail = new Map<string, boolean>()
  if (emails.length > 0) {
    const { data: crmRows } = await supabaseAdmin
      .from('contacts')
      .select('email, marketing_opt_out')
      .in('email', emails)

    marketingByEmail = new Map(
      (crmRows ?? []).map((r: { email: string; marketing_opt_out: boolean }) =>
        [String(r.email).toLowerCase().trim(), Boolean(r.marketing_opt_out)]
      )
    )
  }

  const withMarketing = combinedWithOrders.map((row: Record<string, unknown>) => {
    const em = typeof row.email === 'string' && row.email !== '—' ? row.email.toLowerCase().trim() : ''
    return {
      ...row,
      marketing_opt_out: em ? (marketingByEmail.get(em) ?? false) : false,
    }
  })

  return NextResponse.json(withMarketing)
}
