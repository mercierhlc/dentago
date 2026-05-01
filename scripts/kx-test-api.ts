/**
 * Test KX product API with session UID
 */
import { chromium } from "playwright";
const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

const BASE = "https://api.kentexpress.co.uk";
const BASE_STORE = "kentxprs-gb";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();

  let uid = "";
  let uidSig = "";
  let sigTs = "";
  const productApiHeaders: Record<string, string> = {};

  // Capture login response for session tokens
  page.on("response", async (res) => {
    const url = res.url();
    if (url.includes("accounts.login")) {
      try {
        const json = await res.json();
        const login = json?.AccountsLogin;
        if (login?.UID) {
          uid = login.UID;
          uidSig = login.UIDSignature;
          sigTs = login.signatureTimestamp;
          console.log("Got UID:", uid.slice(0, 20) + "...");
        }
      } catch {}
    }
    // Capture request headers from any product API call
    if (url.includes("api.kentexpress") && url.includes("product")) {
      const reqHeaders = res.request().headers();
      console.log("\nProduct API request headers:", JSON.stringify(reqHeaders, null, 2).slice(0, 500));
    }
  });

  await page.goto("https://www.kentexpress.co.uk/dental", { waitUntil: "networkidle", timeout: 40000 }).catch(() => {});
  await delay(4000);
  await browser.close();

  if (!uid) {
    console.log("No UID captured");
    return;
  }

  // Test products API
  const headers: Record<string, string> = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
    "Accept": "application/json",
    "Content-Type": "application/json",
    "Token": "asdf",
    "ChannelID": "WEB",
    "IsLoggedInUser": "false",
    "x-hs-uid": uid,
    "x-hs-uid-signature": uidSig,
    "x-hs-signature-timestamp": sigTs,
    "Origin": "https://www.kentexpress.co.uk",
    "Referer": "https://www.kentexpress.co.uk/",
  };

  console.log("\nTesting products API...");
  const resp = await fetch(
    `${BASE}/eapi/web-products/v1/products?fields=FULL&baseStoreId=${BASE_STORE}&currentPage=0&pageSize=5&q=gloves`,
    { headers }
  );
  const text = await resp.text();
  console.log(`Status: ${resp.status}`);
  console.log(`Response: ${text.slice(0, 500)}`);
}
main().catch(console.error);
