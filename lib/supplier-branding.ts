/**
 * Shared supplier domains, login URLs, accent colours, and favicon URLs
 * (Google s2) for connect flows — used by Settings → Integrations, /clinic/suppliers, and onboarding.
 */
export const SUPPLIER_META: Record<string, { domain: string; loginUrl: string; logo: string; color: string }> = {
  "Henry Schein": {
    domain: "henryschein.co.uk",
    loginUrl: "https://www.henryschein.co.uk/gb-en/dental/Account/Login",
    logo: "https://www.google.com/s2/favicons?domain=henryschein.co.uk&sz=128",
    color: "#E63329",
  },
  "Dental Sky": {
    domain: "dentalsky.com",
    loginUrl: "https://www.dentalsky.com/customer/account/login",
    logo: "https://www.google.com/s2/favicons?domain=dentalsky.com&sz=128",
    color: "#0077C8",
  },
  "Kent Express": {
    domain: "kentexpress.co.uk",
    loginUrl: "https://www.kentexpress.co.uk/login",
    logo: "https://www.google.com/s2/favicons?domain=kentexpress.co.uk&sz=128",
    color: "#E87722",
  },
  "Dental Directory": {
    domain: "dental-directory.co.uk",
    loginUrl: "https://www.dental-directory.co.uk/login",
    logo: "https://www.google.com/s2/favicons?domain=dental-directory.co.uk&sz=128",
    color: "#005EB8",
  },
  "Clark Dental": {
    domain: "clarkdental.co.uk",
    loginUrl: "https://www.clarkdental.co.uk/login",
    logo: "https://www.google.com/s2/favicons?domain=clarkdental.co.uk&sz=128",
    color: "#2D6A4F",
  },
  Trycare: {
    domain: "trycare.co.uk",
    loginUrl: "https://www.trycare.co.uk/login",
    logo: "https://www.google.com/s2/favicons?domain=trycare.co.uk&sz=128",
    color: "#7B3FC4",
  },
  Optident: {
    domain: "optident.co.uk",
    loginUrl: "https://optident.co.uk/login",
    logo: "https://www.google.com/s2/favicons?domain=optident.co.uk&sz=128",
    color: "#1A73E8",
  },
  DHB: {
    domain: "dhb-dental.com",
    loginUrl: "https://www.dhb-dental.com/account/login",
    logo: "/supplier-dhb-logo.png",
    color: "#1e4d8b",
  },
  Amalgadent: {
    domain: "amalgadent.com",
    loginUrl: "https://www.amalgadent.com/login",
    logo: "https://www.google.com/s2/favicons?domain=amalgadent.com&sz=128",
    color: "#C0392B",
  },
  Wrights: {
    domain: "wrightsdentals.com",
    loginUrl: "https://www.wrightsdentals.com/login",
    logo: "https://www.google.com/s2/favicons?domain=wrightsdentals.com&sz=128",
    color: "#117A65",
  },
  DMI: {
    domain: "dmiuk.com",
    loginUrl: "https://www.dmiuk.com/login",
    logo: "https://www.google.com/s2/favicons?domain=dmiuk.com&sz=128",
    color: "#111111",
  },
  "DD Group": {
    domain: "ddgroup.com",
    loginUrl: "https://www.ddgroup.com/login",
    logo: "https://www.google.com/s2/favicons?domain=ddgroup.com&sz=128",
    color: "#E8A020",
  },
  "Total Dent": {
    domain: "totaldent.co.uk",
    loginUrl: "https://www.totaldent.co.uk/login",
    logo: "https://www.google.com/s2/favicons?domain=totaldent.co.uk&sz=128",
    color: "#003087",
  },
  Medisave: {
    domain: "medisave.co.uk",
    loginUrl: "https://www.medisave.co.uk/login",
    logo: "https://www.google.com/s2/favicons?domain=medisave.co.uk&sz=128",
    color: "#00897B",
  },
  "J&S Davis": {
    domain: "jsdavis.co.uk",
    loginUrl: "https://www.jsdavis.co.uk/login",
    logo: "https://www.google.com/s2/favicons?domain=jsdavis.co.uk&sz=128",
    color: "#1565C0",
  },
  Medentra: {
    domain: "medentra.co.uk",
    loginUrl: "https://www.medentra.co.uk/login",
    logo: "https://www.google.com/s2/favicons?domain=medentra.co.uk&sz=128",
    color: "#00838F",
  },
  Nuvelo: {
    domain: "nuvelo.co.uk",
    loginUrl: "https://www.nuvelo.co.uk/login",
    logo: "https://www.google.com/s2/favicons?domain=nuvelo.co.uk&sz=128",
    color: "#111111",
  },
  "Patterson Dental": {
    domain: "pattersondental.co.uk",
    loginUrl: "https://www.pattersondental.co.uk/",
    logo: "https://www.google.com/s2/favicons?domain=pattersondental.co.uk&sz=128",
    color: "#003DA5",
  },
};

/** Map catalogue / UI names to keys in {@link SUPPLIER_META}. */
const SUPPLIER_META_ALIASES: Record<string, keyof typeof SUPPLIER_META> = {
  "Wrights Group": "Wrights",
  "Total Dental": "Total Dent",
};

/**
 * Resolve branding (favicon URL + accent) for a supplier label from search, cart, or DB.
 * Falls back to grey + no logo when unknown.
 */
export function getSupplierBranding(supplierName: string): {
  logo: string | null;
  color: string;
  metaKey: string | null;
} {
  const trimmed = supplierName.trim();
  if (!trimmed) {
    return { logo: null, color: "#111111", metaKey: null };
  }
  const fromAlias = SUPPLIER_META_ALIASES[trimmed];
  const direct =
    trimmed in SUPPLIER_META ? (trimmed as keyof typeof SUPPLIER_META) : null;
  const key = fromAlias ?? direct;
  if (key && SUPPLIER_META[key]) {
    const m = SUPPLIER_META[key];
    return { logo: m.logo, color: m.color, metaKey: key };
  }
  return { logo: null, color: "#111111", metaKey: null };
}

/** Suppliers shown on Get started → “Connect your first supplier” (order matches UX). */
export const ONBOARDING_CONNECT_SUPPLIERS = [
  "Henry Schein",
  "DHB",
  "DD Group",
  "Kent Express",
  "Dental Sky",
  "Wrights",
] as const;

export type OnboardingConnectSupplier = (typeof ONBOARDING_CONNECT_SUPPLIERS)[number];

export const ONBOARDING_CONNECT_SUPPLIER_SET = new Set<string>(ONBOARDING_CONNECT_SUPPLIERS);
