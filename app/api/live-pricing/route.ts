import { NextResponse } from "next/server";

// Static fallback pricing — updated manually when scraping is unavailable
const STATIC_PRICES: Record<string, { supplier: string; price: number; stock: boolean }[]> = {
  "nitrile-gloves-large": [
    { supplier: "Dental Sky",   price: 4.85, stock: true  },
    { supplier: "DHB",          price: 4.95, stock: false },
    { supplier: "Kent Express", price: 5.20, stock: true  },
    { supplier: "Henry Schein", price: 5.65, stock: true  },
  ],
  "septanest-articaine": [
    { supplier: "Henry Schein",     price: 28.40, stock: true  },
    { supplier: "Kent Express",     price: 29.80, stock: true  },
    { supplier: "Dental Directory", price: 30.50, stock: true  },
    { supplier: "Dental Sky",       price: 31.20, stock: false },
  ],
  "face-masks-iir": [
    { supplier: "Clark Dental", price: 3.20, stock: true  },
    { supplier: "Dental Sky",   price: 3.45, stock: true  },
    { supplier: "Amalgadent",   price: 3.50, stock: true  },
    { supplier: "Kent Express", price: 3.65, stock: true  },
  ],
  "filtek-z250-a1": [
    { supplier: "Wrights",      price: 17.90, stock: true  },
    { supplier: "Henry Schein", price: 18.75, stock: true  },
    { supplier: "Kent Express", price: 19.40, stock: true  },
  ],
  "protaper-gold-f1": [
    { supplier: "Trycare",      price: 32.50, stock: true  },
    { supplier: "DMI",          price: 33.10, stock: false },
    { supplier: "Kent Express", price: 34.00, stock: true  },
    { supplier: "Henry Schein", price: 35.60, stock: true  },
  ],
  "optim33-wipes": [
    { supplier: "Dental Directory", price: 11.40, stock: true  },
    { supplier: "Dental Sky",       price: 11.90, stock: true  },
    { supplier: "Clark Dental",     price: 12.40, stock: true  },
    { supplier: "Henry Schein",     price: 13.20, stock: true  },
  ],
};

// Attempt to scrape a live price from Dental Sky for a given search term.
// Returns null if the request fails or the price cannot be parsed.
async function scrapeDentalSkyPrice(searchTerm: string): Promise<number | null> {
  try {
    const url = `https://www.dentalsky.com/catalogsearch/result/?q=${encodeURIComponent(searchTerm)}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Dentago-PriceBot/1.0; +https://dentago.co.uk)",
        "Accept": "text/html",
      },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    // Dental Sky renders prices as: £4.85 or data-price="4.85"
    const match = html.match(/data-price="([\d.]+)"/);
    if (match) return parseFloat(match[1]);
    const priceMatch = html.match(/class="price">£([\d.]+)</);
    if (priceMatch) return parseFloat(priceMatch[1]);
    return null;
  } catch {
    return null;
  }
}

async function scrapeKentExpressPrice(searchTerm: string): Promise<number | null> {
  try {
    const url = `https://www.kentexpress.co.uk/search?q=${encodeURIComponent(searchTerm)}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Dentago-PriceBot/1.0; +https://dentago.co.uk)",
        "Accept": "text/html",
      },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    const match = html.match(/class="product-price[^"]*"[^>]*>£([\d.]+)/);
    if (match) return parseFloat(match[1]);
    return null;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const productId = searchParams.get("id");

  if (!productId || !STATIC_PRICES[productId]) {
    return NextResponse.json({ error: "Unknown product" }, { status: 400 });
  }

  // Map productId to a search term for live scraping
  const searchTerms: Record<string, { dentalSky: string; kentExpress: string }> = {
    "nitrile-gloves-large":  { dentalSky: "cranberry nitrile gloves large",   kentExpress: "nitrile gloves large 100" },
    "septanest-articaine":   { dentalSky: "septanest articaine",               kentExpress: "septanest 4% articaine" },
    "face-masks-iir":        { dentalSky: "type iir surgical face masks",      kentExpress: "surgical face masks iir 50" },
    "filtek-z250-a1":        { dentalSky: "filtek z250 a1",                    kentExpress: "3m filtek z250 a1" },
    "protaper-gold-f1":      { dentalSky: "protaper gold f1",                  kentExpress: "protaper gold rotary f1" },
    "optim33-wipes":         { dentalSky: "optim 33 wipes",                    kentExpress: "optim 33 tb wipes" },
  };

  const terms = searchTerms[productId];
  const staticData = STATIC_PRICES[productId];

  // Attempt live scraping in parallel
  const [dentalSkyLive, kentExpressLive] = await Promise.all([
    scrapeDentalSkyPrice(terms.dentalSky),
    scrapeKentExpressPrice(terms.kentExpress),
  ]);

  // Merge live prices into the static data where available
  const prices = staticData.map(entry => {
    if (entry.supplier === "Dental Sky" && dentalSkyLive !== null) {
      return { ...entry, price: dentalSkyLive, live: true };
    }
    if (entry.supplier === "Kent Express" && kentExpressLive !== null) {
      return { ...entry, price: kentExpressLive, live: true };
    }
    return { ...entry, live: false };
  });

  const anyLive = prices.some(p => (p as { live: boolean }).live);

  return NextResponse.json({
    productId,
    prices,
    source: anyLive ? "mixed" : "static",
    fetchedAt: new Date().toISOString(),
  });
}
