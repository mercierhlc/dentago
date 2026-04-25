declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
  }
}

export function trackEvent(eventName: string, params?: Record<string, string | number>) {
  if (typeof window === "undefined" || !window.gtag) return;
  window.gtag("event", eventName, params);
}

// Key conversion events
export const Analytics = {
  signupCompleted: (clinicName: string) =>
    trackEvent("sign_up", { method: "email", clinic_name: clinicName }),

  demoBooked: () =>
    trackEvent("demo_booked", { event_category: "conversion" }),

  supplierConnected: (supplierName: string) =>
    trackEvent("supplier_connected", { supplier_name: supplierName }),

  firstSearch: (query: string) =>
    trackEvent("first_search", { search_term: query }),

  orderPlaced: (value: number) =>
    trackEvent("purchase", { currency: "GBP", value }),
};
