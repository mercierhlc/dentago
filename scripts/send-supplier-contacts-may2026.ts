/**
 * Supplier partnership outreach — Dental Sky, Wright's Dental, Kent Express
 * May 2026 — individual emails per contact.
 *
 * Run:  npx tsx scripts/send-supplier-contacts-may2026.ts
 * Dry:  npx tsx scripts/send-supplier-contacts-may2026.ts --dry-run
 */
import { Resend } from "resend";
import * as fs from "fs";
import * as path from "path";

function loadEnv(file: string) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
loadEnv(path.resolve(__dirname, "..", ".env.local"));
loadEnv(path.resolve(__dirname, "..", ".env"));

const DRY_RUN = process.argv.includes("--dry-run");
const FROM = "Mercier <mercier@dentago.co.uk>";
const REPLY_TO = "mercier@dentago.co.uk";
const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

// ─────────────────────────────────────────────
// DENTAL SKY
// ─────────────────────────────────────────────

const dentalSkyContacts = [
  {
    to: "craig.ryan@dentalsky.com",
    firstName: "Craig",
    subject: "Dental Sky as the price leader on Dentago — quick chat?",
    text: `Hi Craig,

I'm Mercier, founder of Dentago — a free procurement marketplace for UK dental practices. One search, every UK supplier side-by-side with live pricing, single checkout. Think VetCove for UK dental.

I'm reaching out because I've been running Dental Sky's catalogue against the rest of the UK market and the picture is genuinely good for you: across consumables, infection control, and endo, Dental Sky consistently undercuts Henry Schein and Kent Express on a per-line basis. That's not a sales line — that's what every clinic comparison-shopping on Dentago will see in real time.

What that means in practice:
- Practices that currently default to Henry Schein out of habit will see Dental Sky win on price before they even hit add to cart
- We're tracking toward £3M/month in GMV across the platform — and the pricing data suggests a significant share of that naturally routes to Dental Sky
- We're already in conversations with Henry Schein's UK team, so the supplier network is taking shape fast

For Dental Sky, what I'd want to discuss:
- A founding catalogue partnership (direct feed rather than public-page scraping) so your data on Dentago is always current
- How we surface Dental Sky as the default recommendation in categories where you're price-competitive
- Commission structure — zero upfront cost, we work on margin from completed orders

15 minutes this week or next? Happy to come to your office or do it on a call.

Best,
Mercier
Founder, Dentago
mercier@dentago.co.uk
+447466 607116
dentago.co.uk`,
    html: `<p>Hi Craig,</p>

<p>I'm Mercier, founder of <strong>Dentago</strong> — a free procurement marketplace for UK dental practices. One search, every UK supplier side-by-side with live pricing, single checkout. Think VetCove for UK dental.</p>

<p>I'm reaching out because I've been running Dental Sky's catalogue against the rest of the UK market and the picture is genuinely good for you: across consumables, infection control, and endo, <strong>Dental Sky consistently undercuts Henry Schein and Kent Express on a per-line basis</strong>. That's not a sales line — that's what every clinic comparison-shopping on Dentago will see in real time.</p>

<p><strong>What that means in practice:</strong></p>
<ul>
  <li>Practices that currently default to Henry Schein out of habit will see Dental Sky win on price before they even hit add to cart</li>
  <li>We're tracking toward <strong>£3M/month in GMV</strong> across the platform — and the pricing data suggests a significant share of that naturally routes to Dental Sky</li>
  <li>We're already in conversations with Henry Schein's UK team, so the supplier network is taking shape fast</li>
</ul>

<p><strong>For Dental Sky, what I'd want to discuss:</strong></p>
<ul>
  <li>A founding catalogue partnership (direct feed rather than public-page scraping) so your data on Dentago is always current</li>
  <li>How we surface Dental Sky as the default recommendation in categories where you're price-competitive</li>
  <li>Commission structure — zero upfront cost, we work on margin from completed orders</li>
</ul>

<p>15 minutes this week or next? Happy to come to your office or do it on a call.</p>

<p>Best,<br>
Mercier<br>
Founder, Dentago<br>
<a href="mailto:mercier@dentago.co.uk">mercier@dentago.co.uk</a> · +447466 607116 · <a href="https://dentago.co.uk">dentago.co.uk</a></p>`,
  },
  {
    to: "adam.welbourn@dentalsky.com",
    firstName: "Adam",
    subject: "Getting Dental Sky in front of every UK practice actively buying — Dentago",
    text: `Hi Adam,

I'm Mercier, founder of Dentago — a free procurement marketplace for UK dental clinics. Practices search one platform, see every UK supplier's pricing side-by-side, and order from all of them in a single cart.

I'm writing because Dental Sky's pricing data tells an interesting story. Having indexed your catalogue against the wider UK supplier market, Dental Sky prices out as the clear leader across most consumable categories — gloves, masks, infection control, endo. When a practice manager runs a comparison on Dentago, that result is what they see before they decide where to buy.

The opportunity here for Dental Sky:
- Practices that have never had a reason to switch from their incumbent supplier (usually HS) will see your prices win on a direct comparison — without you having to lift a finger
- We have clinics actively using the platform now and are tracking toward £3M/month GMV — we're already in active discussions with Henry Schein UK on the supplier side, so the network is real
- A founding catalogue partnership means your full SKU list, your live pricing, and your stock status are surfaced correctly — not scraped approximations

Worth a 15-minute conversation to see if this fits? I can come to you or jump on a call whenever works.

Best,
Mercier
Founder, Dentago
mercier@dentago.co.uk
+447466 607116
dentago.co.uk`,
    html: `<p>Hi Adam,</p>

<p>I'm Mercier, founder of <strong>Dentago</strong> — a free procurement marketplace for UK dental clinics. Practices search one platform, see every UK supplier's pricing side-by-side, and order from all of them in a single cart.</p>

<p>I'm writing because Dental Sky's pricing data tells an interesting story. Having indexed your catalogue against the wider UK supplier market, <strong>Dental Sky prices out as the clear leader across most consumable categories</strong> — gloves, masks, infection control, endo. When a practice manager runs a comparison on Dentago, that result is what they see before they decide where to buy.</p>

<p><strong>The opportunity here for Dental Sky:</strong></p>
<ul>
  <li>Practices that have never had a reason to switch from their incumbent supplier (usually HS) will see your prices win on a direct comparison — without you having to lift a finger</li>
  <li>We have clinics actively using the platform now and are tracking toward <strong>£3M/month GMV</strong> — we're already in active discussions with Henry Schein UK on the supplier side, so the network is real</li>
  <li>A founding catalogue partnership means your full SKU list, your live pricing, and your stock status are surfaced correctly — not scraped approximations</li>
</ul>

<p>Worth a 15-minute conversation to see if this fits? I can come to you or jump on a call whenever works.</p>

<p>Best,<br>
Mercier<br>
Founder, Dentago<br>
<a href="mailto:mercier@dentago.co.uk">mercier@dentago.co.uk</a> · +447466 607116 · <a href="https://dentago.co.uk">dentago.co.uk</a></p>`,
  },
  {
    to: "lauren.abraham@dentalsky.com",
    firstName: "Lauren",
    subject: "Dentago — putting Dental Sky in front of every practice that price-compares",
    text: `Hi Lauren,

I'm Mercier, founder of Dentago — a free procurement marketplace for UK dental practices. Clinics search one place, compare every UK supplier's live pricing on the same screen, and order from all of them in a single checkout.

I wanted to get in touch because the data we've pulled on Dental Sky's catalogue is worth sharing: across most consumable and infection-control categories, Dental Sky is the price leader in the UK market. That puts you in a strong position on Dentago — when a practice is actively comparing suppliers, Dental Sky wins by default on price before they even have to think about it.

We're working with Henry Schein's UK team already and are tracking toward £3M/month in GMV across the platform. Based on the pricing comparison data, a meaningful portion of that order flow would naturally route to Dental Sky.

What I'd want to explore:
- A direct catalogue integration so Dental Sky's full range is represented accurately on the platform (not scraped from your public pages)
- How we can flag Dental Sky as the recommended supplier for categories where your pricing is strongest
- What a commercial partnership looks like — zero upfront cost, commission on completed orders

If you're the right person to speak to about this, I'd love 15 minutes. If not, happy to be pointed in the right direction.

Best,
Mercier
Founder, Dentago
mercier@dentago.co.uk
+447466 607116
dentago.co.uk`,
    html: `<p>Hi Lauren,</p>

<p>I'm Mercier, founder of <strong>Dentago</strong> — a free procurement marketplace for UK dental practices. Clinics search one place, compare every UK supplier's live pricing on the same screen, and order from all of them in a single checkout.</p>

<p>I wanted to get in touch because the data we've pulled on Dental Sky's catalogue is worth sharing: <strong>across most consumable and infection-control categories, Dental Sky is the price leader in the UK market</strong>. That puts you in a strong position on Dentago — when a practice is actively comparing suppliers, Dental Sky wins by default on price before they even have to think about it.</p>

<p>We're working with Henry Schein's UK team already and are tracking toward <strong>£3M/month in GMV</strong> across the platform. Based on the pricing comparison data, a meaningful portion of that order flow would naturally route to Dental Sky.</p>

<p><strong>What I'd want to explore:</strong></p>
<ul>
  <li>A direct catalogue integration so Dental Sky's full range is represented accurately on the platform (not scraped from your public pages)</li>
  <li>How we can flag Dental Sky as the recommended supplier for categories where your pricing is strongest</li>
  <li>What a commercial partnership looks like — zero upfront cost, commission on completed orders</li>
</ul>

<p>If you're the right person to speak to about this, I'd love 15 minutes. If not, happy to be pointed in the right direction.</p>

<p>Best,<br>
Mercier<br>
Founder, Dentago<br>
<a href="mailto:mercier@dentago.co.uk">mercier@dentago.co.uk</a> · +447466 607116 · <a href="https://dentago.co.uk">dentago.co.uk</a></p>`,
  },
  {
    to: "kym.penfold@dentalsky.com",
    firstName: "Kym",
    subject: "Dental Sky on Dentago — the platform where UK clinics are now price-comparing",
    text: `Hi Kym,

I'm Mercier, founder of Dentago — a free procurement marketplace for UK dental clinics. Practices search one platform, see all UK suppliers' live pricing on the same page, and buy from multiple suppliers in one cart.

The reason I'm reaching out: Dental Sky's pricing is strong. Having benchmarked your catalogue across the UK supplier landscape, Dental Sky comes out ahead on price across most consumables, infection control, and endo products — and that's exactly the signal Dentago surfaces to practices when they search. The cheapest stocked option wins. Right now, that's regularly Dental Sky.

We're tracking toward £3M/month in GMV on the platform. We're already in active conversations with Henry Schein UK, and the clinic base is growing — these are practices actively buying, not just browsing.

The reason Dental Sky should care about being a founding partner:
- You get distribution to clinics who have never bought from you, without any sales effort on your end
- Practices who are currently with Henry Schein out of inertia will see Dental Sky's prices first every time they search
- A proper catalogue integration (not scraping) means your data is always accurate and complete on the platform

Happy to walk through the platform on a quick call and discuss what a partnership looks like. Let me know if there's a better person to speak with about this.

Best,
Mercier
Founder, Dentago
mercier@dentago.co.uk
+447466 607116
dentago.co.uk`,
    html: `<p>Hi Kym,</p>

<p>I'm Mercier, founder of <strong>Dentago</strong> — a free procurement marketplace for UK dental clinics. Practices search one platform, see all UK suppliers' live pricing on the same page, and buy from multiple suppliers in one cart.</p>

<p>The reason I'm reaching out: Dental Sky's pricing is strong. Having benchmarked your catalogue across the UK supplier landscape, <strong>Dental Sky comes out ahead on price across most consumables, infection control, and endo products</strong> — and that's exactly the signal Dentago surfaces to practices when they search. The cheapest stocked option wins. Right now, that's regularly Dental Sky.</p>

<p>We're tracking toward <strong>£3M/month in GMV</strong> on the platform. We're already in active conversations with Henry Schein UK, and the clinic base is growing — these are practices actively buying, not just browsing.</p>

<p><strong>The reason Dental Sky should care about being a founding partner:</strong></p>
<ul>
  <li>You get distribution to clinics who have never bought from you, without any sales effort on your end</li>
  <li>Practices who are currently with Henry Schein out of inertia will see Dental Sky's prices first every time they search</li>
  <li>A proper catalogue integration (not scraping) means your data is always accurate and complete on the platform</li>
</ul>

<p>Happy to walk through the platform on a quick call and discuss what a partnership looks like. Let me know if there's a better person to speak with about this.</p>

<p>Best,<br>
Mercier<br>
Founder, Dentago<br>
<a href="mailto:mercier@dentago.co.uk">mercier@dentago.co.uk</a> · +447466 607116 · <a href="https://dentago.co.uk">dentago.co.uk</a></p>`,
  },
];

// ─────────────────────────────────────────────
// WRIGHT'S DENTAL
// ─────────────────────────────────────────────

const wrightsContacts = [
  {
    to: "gemma.osment@wrightdental.co.uk",
    firstName: "Gemma",
    subject: "Getting Wright's Dental in front of the UK practices actively buying online — Dentago",
    text: `Hi Gemma,

I'm Mercier, founder of Dentago — a free procurement marketplace for UK dental clinics. Practices search one platform, see every UK supplier's pricing side-by-side, and complete orders from multiple suppliers in a single checkout. Think VetCove, but for UK dental.

I'm reaching out to Wright's Dental because the shift to online procurement is accelerating and I want to make sure you're positioned to capture it. We already have clinics using the platform actively, we're in commercial conversations with Henry Schein UK, and we're tracking toward £3M/month in GMV.

What being on Dentago means for Wright's Dental:
- Your full product range in front of practices who are actively comparing prices and placing orders — not just browsing
- New clinic customers you wouldn't otherwise reach, particularly outside your core geographic footprint
- Your existing account pricing respected — practices with a Wright's Dental account see their negotiated rates when logged in
- Zero upfront cost — our commercial model is commission on orders placed through the platform

Wright's Dental has a strong reputation and good pricing. The clinics already on Dentago who aren't currently buying from you should be — this is the shortest path to getting in front of them.

15 minutes to walk through the platform and how the partnership works? Happy to call whenever suits.

Best,
Mercier
Founder, Dentago
mercier@dentago.co.uk
+447466 607116
dentago.co.uk`,
    html: `<p>Hi Gemma,</p>

<p>I'm Mercier, founder of <strong>Dentago</strong> — a free procurement marketplace for UK dental clinics. Practices search one platform, see every UK supplier's pricing side-by-side, and complete orders from multiple suppliers in a single checkout. Think VetCove, but for UK dental.</p>

<p>I'm reaching out to Wright's Dental because the shift to online procurement is accelerating and I want to make sure you're positioned to capture it. We already have clinics using the platform actively, we're in commercial conversations with Henry Schein UK, and we're tracking toward <strong>£3M/month in GMV</strong>.</p>

<p><strong>What being on Dentago means for Wright's Dental:</strong></p>
<ul>
  <li>Your full product range in front of practices who are actively comparing prices and placing orders — not just browsing</li>
  <li>New clinic customers you wouldn't otherwise reach, particularly outside your core geographic footprint</li>
  <li>Your existing account pricing respected — practices with a Wright's Dental account see their negotiated rates when logged in</li>
  <li>Zero upfront cost — our commercial model is commission on orders placed through the platform</li>
</ul>

<p>Wright's Dental has a strong reputation and good pricing. The clinics already on Dentago who aren't currently buying from you should be — this is the shortest path to getting in front of them.</p>

<p>15 minutes to walk through the platform and how the partnership works? Happy to call whenever suits.</p>

<p>Best,<br>
Mercier<br>
Founder, Dentago<br>
<a href="mailto:mercier@dentago.co.uk">mercier@dentago.co.uk</a> · +447466 607116 · <a href="https://dentago.co.uk">dentago.co.uk</a></p>`,
  },
  {
    to: "Graham.wilson@wrightdental.co.uk",
    firstName: "Graham",
    subject: "Wright's Dental on Dentago — supplier partnership conversation",
    text: `Hi Graham,

I'm Mercier, founder of Dentago — a free procurement marketplace for UK dental practices. One search across every UK supplier, live pricing side-by-side, single checkout. We're building the platform that makes supplier switching frictionless for UK clinics.

I wanted to reach out to Wright's Dental directly because I think there's a strong commercial case for getting you on the platform early. We're tracking toward £3M/month in GMV, we're already in discussions with Henry Schein UK and other major suppliers, and the clinic base is active and growing.

What I've seen from the procurement data so far: a lot of clinics are still buying from one or two suppliers out of habit, not because those suppliers have the best price or service. Dentago changes that by putting every supplier's offer in front of the practice at the point of decision. That's an opportunity for Wright's Dental to pick up orders from clinics who would have defaulted elsewhere.

Here's what a founding partnership looks like:
- Direct catalogue feed from Wright's Dental so your full range and current pricing are on the platform accurately
- Your existing negotiated account prices come through when a clinic logs in with their account
- Wright's Dental surfaced prominently to clinics searching in categories where you're competitive
- Commission-only commercial model — no upfront cost

Would a 20-minute call this week or next make sense? I'm happy to walk through the platform and where Wright's Dental fits.

Best,
Mercier
Founder, Dentago
mercier@dentago.co.uk
+447466 607116
dentago.co.uk`,
    html: `<p>Hi Graham,</p>

<p>I'm Mercier, founder of <strong>Dentago</strong> — a free procurement marketplace for UK dental practices. One search across every UK supplier, live pricing side-by-side, single checkout. We're building the platform that makes supplier switching frictionless for UK clinics.</p>

<p>I wanted to reach out to Wright's Dental directly because I think there's a strong commercial case for getting you on the platform early. We're tracking toward <strong>£3M/month in GMV</strong>, we're already in discussions with Henry Schein UK and other major suppliers, and the clinic base is active and growing.</p>

<p>What I've seen from the procurement data so far: a lot of clinics are still buying from one or two suppliers out of habit, not because those suppliers have the best price or service. Dentago changes that by putting every supplier's offer in front of the practice at the point of decision. That's an opportunity for Wright's Dental to pick up orders from clinics who would have defaulted elsewhere.</p>

<p><strong>Here's what a founding partnership looks like:</strong></p>
<ul>
  <li>Direct catalogue feed from Wright's Dental so your full range and current pricing are on the platform accurately</li>
  <li>Your existing negotiated account prices come through when a clinic logs in with their account</li>
  <li>Wright's Dental surfaced prominently to clinics searching in categories where you're competitive</li>
  <li>Commission-only commercial model — no upfront cost</li>
</ul>

<p>Would a 20-minute call this week or next make sense? I'm happy to walk through the platform and where Wright's Dental fits.</p>

<p>Best,<br>
Mercier<br>
Founder, Dentago<br>
<a href="mailto:mercier@dentago.co.uk">mercier@dentago.co.uk</a> · +447466 607116 · <a href="https://dentago.co.uk">dentago.co.uk</a></p>`,
  },
];

// ─────────────────────────────────────────────
// KENT EXPRESS
// ─────────────────────────────────────────────

const kentExpressContacts = [
  {
    to: "larry.bohan@kentexpress.co.uk",
    firstName: "Larry",
    subject: "Kent Express on Dentago — clinics comparing prices across all UK suppliers",
    text: `Hi Larry,

I'm Mercier, founder of Dentago — a free procurement marketplace for UK dental clinics. One platform, every UK supplier's live pricing side-by-side, single checkout. We're building the infrastructure layer for UK dental procurement.

I wanted to reach out to Kent Express directly because you've built one of the most respected supplier businesses in UK dental — strong catalogue depth, solid logistics, a client base that trusts you. The question is whether that translates to the clinics who are now starting their buying journey on a comparison platform rather than going direct.

We're tracking toward £3M/month in GMV and are actively building out the supplier network. We're already in discussions with Henry Schein UK's commercial team. Kent Express being in the comparison at the point of decision — with accurate pricing and stock status — means you're not losing orders to suppliers with less depth simply because a practice manager compared online and you weren't there.

What I'd want to discuss:
- Getting Kent Express's catalogue represented accurately on Dentago (direct feed rather than public-page scraping)
- How account pricing works for practices that already have a Kent Express account — those clients see their negotiated rates when logged in
- What a commercial partnership looks like — commission on orders placed, no upfront cost

Worth 15 minutes? I can come to your office or jump on a call.

Best,
Mercier
Founder, Dentago
mercier@dentago.co.uk
+447466 607116
dentago.co.uk`,
    html: `<p>Hi Larry,</p>

<p>I'm Mercier, founder of <strong>Dentago</strong> — a free procurement marketplace for UK dental clinics. One platform, every UK supplier's live pricing side-by-side, single checkout. We're building the infrastructure layer for UK dental procurement.</p>

<p>I wanted to reach out to Kent Express directly because you've built one of the most respected supplier businesses in UK dental — strong catalogue depth, solid logistics, a client base that trusts you. The question is whether that translates to the clinics who are now starting their buying journey on a comparison platform rather than going direct.</p>

<p>We're tracking toward <strong>£3M/month in GMV</strong> and are actively building out the supplier network. We're already in discussions with Henry Schein UK's commercial team. Kent Express being in the comparison at the point of decision — with accurate pricing and stock status — means you're not losing orders to suppliers with less depth simply because a practice manager compared online and you weren't there.</p>

<p><strong>What I'd want to discuss:</strong></p>
<ul>
  <li>Getting Kent Express's catalogue represented accurately on Dentago (direct feed rather than public-page scraping)</li>
  <li>How account pricing works for practices that already have a Kent Express account — those clients see their negotiated rates when logged in</li>
  <li>What a commercial partnership looks like — commission on orders placed, no upfront cost</li>
</ul>

<p>Worth 15 minutes? I can come to your office or jump on a call.</p>

<p>Best,<br>
Mercier<br>
Founder, Dentago<br>
<a href="mailto:mercier@dentago.co.uk">mercier@dentago.co.uk</a> · +447466 607116 · <a href="https://dentago.co.uk">dentago.co.uk</a></p>`,
  },
  {
    to: "anthony.trombetta@kentexpress.co.uk",
    firstName: "Anthony",
    subject: "Following up — Dentago + Kent Express partnership",
    text: `Hi Anthony,

Following up on my earlier note about Dentago — the procurement marketplace for UK dental clinics where practices compare every supplier side-by-side and order from all of them in one cart.

I wanted to come back to you because we've moved on a few fronts since I last reached out. We're now tracking toward £3M/month in GMV on the platform, we have active clinic users placing orders, and we're in commercial discussions with Henry Schein UK's team. The supplier network is becoming real.

Kent Express being part of that comparison matters for you. Right now there are practices on Dentago searching for products that you stock at competitive prices — if Kent Express isn't in the comparison, that order doesn't come to you, even if your price would have won.

What I'm after is 15 minutes to walk you through the platform and talk through what a proper partnership looks like — catalogue integration, account pricing for your existing clients on Dentago, and commercial terms.

Is there a good time this week or next?

Best,
Mercier
Founder, Dentago
mercier@dentago.co.uk
+447466 607116
dentago.co.uk`,
    html: `<p>Hi Anthony,</p>

<p>Following up on my earlier note about <strong>Dentago</strong> — the procurement marketplace for UK dental clinics where practices compare every supplier side-by-side and order from all of them in one cart.</p>

<p>I wanted to come back to you because we've moved on a few fronts since I last reached out. We're now tracking toward <strong>£3M/month in GMV</strong> on the platform, we have active clinic users placing orders, and we're in commercial discussions with Henry Schein UK's team. The supplier network is becoming real.</p>

<p>Kent Express being part of that comparison matters for you. Right now there are practices on Dentago searching for products that you stock at competitive prices — if Kent Express isn't in the comparison, that order doesn't come to you, even if your price would have won.</p>

<p>What I'm after is 15 minutes to walk you through the platform and talk through what a proper partnership looks like — catalogue integration, account pricing for your existing clients on Dentago, and commercial terms.</p>

<p>Is there a good time this week or next?</p>

<p>Best,<br>
Mercier<br>
Founder, Dentago<br>
<a href="mailto:mercier@dentago.co.uk">mercier@dentago.co.uk</a> · +447466 607116 · <a href="https://dentago.co.uk">dentago.co.uk</a></p>`,
  },
  {
    to: "anthonytrombetta@gmail.com",
    firstName: "Anthony",
    subject: "Dentago — Kent Express partnership (personal note)",
    text: `Hi Anthony,

Dropping you a note on your personal address as well — I appreciate you may get a lot of supplier/vendor emails on the Kent Express account and I didn't want this one to get lost.

I'm Mercier, founder of Dentago. We're building the procurement marketplace for UK dental clinics — one search, every UK supplier side-by-side with live pricing, single checkout. We're tracking toward £3M/month in GMV and already in conversations with Henry Schein UK. I want to have Kent Express in the comparison.

The short version of why it matters for Kent Express: there are practices on Dentago right now searching for products you stock. If you're not in the comparison at that moment, the order goes elsewhere even if your pricing would have won. Getting Kent Express properly integrated — full catalogue, live pricing, account pricing for existing clients — means you're not invisible at the point of decision.

Would love 15 minutes on a call whenever suits. Reply here or reach me on +447466 607116.

Best,
Mercier
Founder, Dentago
dentago.co.uk`,
    html: `<p>Hi Anthony,</p>

<p>Dropping you a note on your personal address as well — I appreciate you may get a lot of supplier/vendor emails on the Kent Express account and I didn't want this one to get lost.</p>

<p>I'm Mercier, founder of <strong>Dentago</strong>. We're building the procurement marketplace for UK dental clinics — one search, every UK supplier side-by-side with live pricing, single checkout. We're tracking toward <strong>£3M/month in GMV</strong> and already in conversations with Henry Schein UK. I want to have Kent Express in the comparison.</p>

<p>The short version of why it matters for Kent Express: there are practices on Dentago right now searching for products you stock. If you're not in the comparison at that moment, the order goes elsewhere even if your pricing would have won. Getting Kent Express properly integrated — full catalogue, live pricing, account pricing for existing clients — means you're not invisible at the point of decision.</p>

<p>Would love 15 minutes on a call whenever suits. Reply here or reach me on <strong>+447466 607116</strong>.</p>

<p>Best,<br>
Mercier<br>
Founder, Dentago<br>
<a href="https://dentago.co.uk">dentago.co.uk</a></p>`,
  },
  {
    to: "harry.barlow@kentexpress.co.uk",
    firstName: "Harry",
    subject: "Dentago — Kent Express being in the comparison when practices shop online",
    text: `Hi Harry,

I'm Mercier, founder of Dentago — a free procurement marketplace for UK dental practices. Practices search one platform, see every UK supplier's pricing side-by-side, and order from all of them in a single cart.

I'm reaching out to the Kent Express team because there's a straightforward commercial case for getting you on the platform. We're tracking toward £3M/month in GMV, we have active clinic users, and we're building the supplier network now — Henry Schein's UK commercial team are already in discussions with us. The comparison is getting real and I want Kent Express in it.

The risk for Kent Express of not being on Dentago: practices that are already on the platform and searching for products you stock won't see you in the comparison. They'll order from whoever is there. Given Kent Express's depth of catalogue and pricing, that's an outcome that doesn't serve you.

What I'm proposing:
- A founding catalogue partnership — direct feed so Kent Express's full range is represented accurately (not scraped from your public site)
- Account pricing for existing clients — your negotiated rates come through when a practice logs in with their Kent Express account
- Commission-only commercial model — no upfront cost, we earn when an order completes

15 minutes on a call to go through the platform and talk about what this looks like commercially?

Best,
Mercier
Founder, Dentago
mercier@dentago.co.uk
+447466 607116
dentago.co.uk`,
    html: `<p>Hi Harry,</p>

<p>I'm Mercier, founder of <strong>Dentago</strong> — a free procurement marketplace for UK dental practices. Practices search one platform, see every UK supplier's pricing side-by-side, and order from all of them in a single cart.</p>

<p>I'm reaching out to the Kent Express team because there's a straightforward commercial case for getting you on the platform. We're tracking toward <strong>£3M/month in GMV</strong>, we have active clinic users, and we're building the supplier network now — Henry Schein's UK commercial team are already in discussions with us. The comparison is getting real and I want Kent Express in it.</p>

<p>The risk for Kent Express of not being on Dentago: practices that are already on the platform and searching for products you stock won't see you in the comparison. They'll order from whoever is there. Given Kent Express's depth of catalogue and pricing, that's an outcome that doesn't serve you.</p>

<p><strong>What I'm proposing:</strong></p>
<ul>
  <li>A founding catalogue partnership — direct feed so Kent Express's full range is represented accurately (not scraped from your public site)</li>
  <li>Account pricing for existing clients — your negotiated rates come through when a practice logs in with their Kent Express account</li>
  <li>Commission-only commercial model — no upfront cost, we earn when an order completes</li>
</ul>

<p>15 minutes on a call to go through the platform and talk about what this looks like commercially?</p>

<p>Best,<br>
Mercier<br>
Founder, Dentago<br>
<a href="mailto:mercier@dentago.co.uk">mercier@dentago.co.uk</a> · +447466 607116 · <a href="https://dentago.co.uk">dentago.co.uk</a></p>`,
  },
];

// ─────────────────────────────────────────────
// SEND
// ─────────────────────────────────────────────

const allEmails = [
  ...dentalSkyContacts.map(e => ({ ...e, group: "Dental Sky" })),
  ...wrightsContacts.map(e => ({ ...e, group: "Wright's Dental" })),
  ...kentExpressContacts.map(e => ({ ...e, group: "Kent Express" })),
];

async function main() {
  if (!process.env.RESEND_API_KEY) {
    console.error("RESEND_API_KEY missing from .env / .env.local");
    process.exit(1);
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  console.log(`${DRY_RUN ? "[DRY RUN] " : ""}Sending ${allEmails.length} emails...\n`);

  let sent = 0, failed = 0;

  for (let i = 0; i < allEmails.length; i++) {
    const e = allEmails[i];
    const label = `[${i + 1}/${allEmails.length}] ${e.group} — ${e.firstName} <${e.to}>`;

    if (DRY_RUN) {
      console.log(`  DRY  ${label}`);
      console.log(`       Subject: ${e.subject}\n`);
      continue;
    }

    try {
      const result = await resend.emails.send({
        from: FROM,
        to: e.to,
        replyTo: REPLY_TO,
        subject: e.subject,
        text: e.text,
        html: e.html,
      });

      if ((result as any).error) {
        console.error(`  ❌   ${label}\n       ${JSON.stringify((result as any).error)}`);
        failed++;
      } else {
        console.log(`  ✅   ${label}`);
        console.log(`       id: ${(result as any).data?.id}`);
        sent++;
      }
    } catch (err: any) {
      console.error(`  ❌   ${label}\n       ${err?.message}`);
      failed++;
    }

    await delay(400);
  }

  console.log(`\n${DRY_RUN ? "DRY RUN — nothing sent." : `Done: ${sent} sent, ${failed} failed`}`);
}

main().catch(err => { console.error(err); process.exit(1); });
