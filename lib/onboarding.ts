import { supabaseAdmin } from "@/lib/supabase";

export type ClinicProductPlan = "free" | "pro";

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  href: string;
  cta: string;
  /** Free essentials vs Dentago Pro workflow depth */
  tier: ClinicProductPlan;
  /** Shown when tier is Pro but clinic is still on Free */
  locked?: boolean;
}

export function normalizeProductPlan(raw: string | null | undefined): ClinicProductPlan {
  return raw === "pro" ? "pro" : "free";
}

export async function getClinicProductPlan(clinicId: string): Promise<ClinicProductPlan> {
  const { data, error } = await supabaseAdmin.from("clinic_accounts").select("product_plan").eq("id", clinicId).maybeSingle();

  if (error || !data) return "free";
  return normalizeProductPlan((data as { product_plan?: string }).product_plan);
}

export async function getOnboardingStatus(clinicId: string, _plan: ClinicProductPlan): Promise<OnboardingStep[]> {
  const [
    credRow,
    searchRow,
    viewRow,
    orderRow,
    parRow,
    savingsRow,
    approvalOrderRow,
  ] = await Promise.all([
    supabaseAdmin.from("supplier_credentials").select("id").eq("clinic_id", clinicId).limit(1).maybeSingle(),
    supabaseAdmin
      .from("events")
      .select("id")
      .eq("event_type", "search_performed")
      .eq("entity_id", clinicId)
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from("events")
      .select("id")
      .eq("event_type", "product_viewed")
      .eq("entity_id", clinicId)
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from("events")
      .select("id")
      .eq("event_type", "order_placed")
      .eq("entity_id", clinicId)
      .limit(1)
      .maybeSingle(),
    supabaseAdmin.from("clinic_par_levels").select("id").eq("clinic_id", clinicId).limit(1).maybeSingle(),
    supabaseAdmin.from("clinic_savings_log").select("id").eq("clinic_id", clinicId).limit(1).maybeSingle(),
    supabaseAdmin
      .from("dentago_orders")
      .select("id")
      .eq("clinic_id", clinicId)
      .in("approval_status", ["pending_approval", "approved", "rejected"])
      .limit(1)
      .maybeSingle(),
  ]);

  /** Core operational wedge — all Free tier; Dentago Pro will add deeper automation later. */
  const steps: OnboardingStep[] = [
    {
      id: "connect_supplier",
      title: "Connect your supplier accounts",
      description: "Link Henry Schein, Dental Sky, DD Group — your live prices flow into search.",
      completed: !!credRow.data,
      href: "/settings?tab=integrations",
      cta: "Connect suppliers",
      tier: "free",
    },
    {
      id: "first_search",
      title: "Search and add lines",
      description: "Find what you need, then add it to your cart before pushing to the supplier basket.",
      completed: !!searchRow.data,
      href: "/search",
      cta: "Open search",
      tier: "free",
    },
    {
      id: "view_product",
      title: "Open a product detail page",
      description: "Compare pack economics and supplier prices side by side.",
      completed: !!viewRow.data,
      href: "/search",
      cta: "Browse products",
      tier: "free",
    },
    {
      id: "place_order",
      title: "Place your first supplier order",
      description:
        "From your cart, push lines into your supplier basket — you finish checkout on their site; Dentago never takes payment.",
      completed: !!orderRow.data,
      href: "/cart",
      cta: "Open cart",
      tier: "free",
    },
    {
      id: "review_savings",
      title: "Review savings insight",
      description: "See list-price deltas and tracked savings across connected suppliers.",
      completed: !!savingsRow.data,
      href: "/clinic/savings",
      cta: "View savings",
      tier: "free",
    },
    {
      id: "par_levels",
      title: "Set par levels & stock alerts",
      description: "Define minimum stock per SKU so Dentago can flag before you run dry mid-session.",
      completed: !!parRow.data,
      href: "/clinic/par-levels",
      cta: "Open inventory",
      tier: "free",
    },
    {
      id: "approvals_workflow",
      title: "Use approvals & guardrails",
      description: "Route large baskets through a single approver queue — audit-ready overrides.",
      completed: !!approvalOrderRow.data,
      href: "/approvals",
      cta: "Open approvals",
      tier: "free",
    },
  ];

  return steps;
}
