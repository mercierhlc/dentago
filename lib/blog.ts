export type BlogPost = {
  slug: string;
  title: string;
  description: string;
  date: string;
  readTime: string;
  category: string;
  keywords: string[];
  image: string;
  imageAlt: string;
  content: string;
};

export const POSTS: BlogPost[] = [
  {
    slug: "how-uk-dental-practices-can-cut-supply-costs",
    title: "How UK Dental Practices Can Cut Supply Costs by Up to 20% Without Switching Suppliers",
    description:
      "Most UK dental practices overpay on supplies by 15–20% without realising it. Here's exactly how to fix it — without changing suppliers or renegotiating contracts.",
    date: "2026-04-20",
    readTime: "6 min read",
    category: "Procurement",
    image: "https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=1200&q=80",
    imageAlt: "Dental practice interior with supplies",
    keywords: ["reduce dental supply costs UK", "dental practice cost reduction", "dental procurement savings"],
    content: `
## The Hidden Cost Most Practices Don't Track

If you run a UK dental practice, you're almost certainly overpaying on supplies. Not because your suppliers are dishonest — but because comparing prices across multiple suppliers manually is time-consuming, so most practices don't do it consistently.

The average UK dental practice spends between £8,000 and £25,000 per year on dental supplies, depending on size. Research into procurement behaviour across UK practices consistently shows that practices which actively compare prices across suppliers save between 12% and 22% annually compared to those that don't.

That's up to £5,500 per year, for a single practice, that doesn't need to be spent.

## Why Overpaying Happens

The problem isn't that practice managers aren't diligent. It's structural:

**You have accounts with multiple suppliers.** Henry Schein, Kent Express, Dental Sky, DHB — most practices use at least two or three. Each has its own website, its own login, its own catalogue.

**Prices change constantly.** Supplier pricing can shift weekly. The price you got last month may not be the best price today.

**Manual comparison doesn't scale.** Logging into three websites, searching for the same product, noting prices in a spreadsheet, then placing separate orders — it works, but it takes hours. Most practices simply reorder from whoever they ordered from last time.

**Volume discounts are invisible.** If your practice ordered nitrile gloves from two different suppliers this month, you may have missed the volume threshold that would have triggered a discount on one of them.

## The Three Places Practices Overpay Most

After speaking to dozens of UK practice managers, the same three categories come up repeatedly:

**1. PPE and consumables.** Nitrile gloves, masks, and bibs are ordered in high volume and purchased frequently. Even a 10% price difference per box compounds quickly. A practice ordering 20 boxes of gloves per month at £1 more per box than the best available price is spending £240 extra per year on gloves alone.

**2. Local anaesthetics.** Septanest, Lignospan, Citanest — these are ordered in large quantities and price variations between suppliers can be significant. A practice ordering 100 cartridges per month at 20p more per cartridge than the lowest available price spends £240 extra per year on anaesthetics.

**3. Restorative materials.** Composite, glass ionomer, bonding agents — these are high-ticket items where the price difference between suppliers for the same product can reach 15–30%.

## What Actually Works

**Compare at the point of ordering, not after.** The most effective behaviour change is making comparison the default rather than an extra step. If you can see prices from all your suppliers on a single screen when you're ready to order, you'll naturally choose the best one.

**Audit your last three months of orders.** Pull invoices from every supplier you've used in the last quarter. For your top 20 most ordered products, check what the current price is on each of your other supplier accounts. This exercise alone typically reveals 3–5 products where you're paying meaningfully more than you need to.

**Don't switch suppliers — leverage them.** You don't need to move all your business to one supplier to save money. The strategy is to order each product from whichever supplier is cheapest at the time. Suppliers know this, which is why prices are competitive — but only if you're actually checking.

**Standardise your product list.** Agree on a preferred product for each category, then track the price of that specific SKU across suppliers. Standardisation reduces cognitive load and makes comparison faster.

## The Time Problem

The main objection practice managers raise is time. And it's legitimate — manually checking three supplier websites for every product on a purchase order is genuinely time-consuming.

This is exactly the problem Dentago was built to solve. Dentago connects to your existing supplier accounts — Henry Schein, Kent Express, Dental Sky, and others — and shows you real-time prices from all of them in a single search. You search once, see every supplier's current price side by side, add to one cart, and place all orders simultaneously.

The comparison that previously took 40 minutes now takes 40 seconds.

**Dentago is completely free for UK dental practices.** There are no subscriptions, no hidden fees, and no markups. You connect the supplier accounts you already have, and the platform does the comparison work for you.

If your practice spends £15,000 per year on supplies and you save 15%, that's £2,250 back into the practice annually — without changing a single supplier relationship.

[Start comparing prices for free →](https://www.dentago.co.uk/onboarding/step1.html)
    `,
  },
  {
    slug: "henry-schein-vs-kent-express-vs-dental-sky",
    title: "Henry Schein vs Kent Express vs Dental Sky: Which UK Dental Supplier Is Cheapest in 2026?",
    description:
      "A head-to-head comparison of the three biggest UK dental suppliers across the most commonly ordered products. The results might surprise you.",
    date: "2026-04-20",
    readTime: "7 min read",
    category: "Suppliers",
    image: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=1200&q=80",
    imageAlt: "Dental supplies and products on a shelf",
    keywords: ["Henry Schein vs Kent Express", "cheapest dental supplier UK", "Dental Sky prices", "UK dental supplier comparison"],
    content: `
## The Three Giants of UK Dental Supply

Henry Schein, Kent Express, and Dental Sky together account for the majority of dental supply spend across UK practices. Most practices have accounts with at least two of them — and many use all three.

But which one is actually cheapest? The honest answer is: it depends on the product, the month, and your account tier. There is no single cheapest supplier across the board. What matters is knowing which supplier is cheapest for each specific product you order — and checking at the point of ordering rather than assuming.

Here's a category-by-category breakdown.

## Nitrile Gloves

Nitrile gloves are among the most price-competitive products in dental supply, because they're high volume and standardised. Every supplier knows they're being compared on this product, so pricing is relatively tight.

**What we see:** Kent Express tends to be competitive on own-brand nitrile gloves. Henry Schein's own-brand Medicom line is often comparable, with price variations of 3–8% between suppliers on equivalent products. Dental Sky's Smart Blue nitrile gloves are frequently the lowest-cost option per glove when bought in case quantities.

**Verdict:** Check all three. The difference on gloves is small but compounds — a practice ordering 30 boxes per month at even 5% difference is spending £150–£300 extra per year unnecessarily.

## Local Anaesthetics

This is where price differences become more significant. Septanest, Lignospan, and Ultracaine are brand-specific products that carry relatively fixed RRPs — but supplier pricing varies meaningfully.

**What we see:** Henry Schein typically carries the widest range of anaesthetic products and often offers volume pricing at lower thresholds than competitors. Kent Express is frequently competitive on Septanest specifically. Dental Sky's pricing on anaesthetics can be notably lower than the two larger suppliers on certain SKUs, though availability is sometimes limited.

**Verdict:** If you're ordering 100+ cartridges per month, Henry Schein's volume tiers often make them competitive. Below that threshold, Kent Express and Dental Sky frequently undercut on list price.

## Composite Resins

Composite is where the real money is. Products like Filtek Z250, Tetric EvoCeram, and Venus Pearl are expensive, and the price difference between suppliers for the same product can reach 20–30%.

**What we see:** Henry Schein tends to run more frequent promotional pricing on composite than the other two, particularly on 3M products. Kent Express is consistently competitive on Dentsply and Ivoclar lines. Dental Sky's composite pricing is often the lowest list price but with fewer promotions.

**Verdict:** Never order composite without checking all three. A single syringe of premium composite can vary by £8–£15 between suppliers. A practice using 10 syringes per month at a £10 average difference is spending £1,200 extra per year.

## PPE (Masks, Aprons, Bibs)

PPE pricing is highly competitive across all three suppliers because the products are largely commoditised. The quality of own-brand PPE varies, so it's worth comparing like-for-like.

**What we see:** Dental Sky is most frequently the lowest-cost option on PPE, particularly for own-brand masks and bibs. Henry Schein and Kent Express are competitive but rarely the cheapest. The gap can be 15–25% on PPE.

**Verdict:** If your practice is buying PPE from Henry Schein or Kent Express without checking Dental Sky, you're almost certainly overpaying.

## Infection Control Products

Cavicide, OptIM 33, and similar infection control products have more price stability than other categories, but differences still exist.

**What we see:** Kent Express is frequently the most competitive on infection control, particularly on Metrex products. Henry Schein competes closely. Dental Sky has a narrower range.

**Verdict:** Check Kent Express first, then Henry Schein for availability.

## The Real Answer: It Depends on the Order

The honest conclusion from looking at pricing across these three suppliers is that no single supplier wins consistently across all categories. A practice that orders gloves from the cheapest, anaesthetics from the cheapest, and composite from the cheapest will consistently spend 15–20% less than one that orders everything from a single supplier out of habit.

The challenge is that checking three supplier websites manually for every order is impractical.

## How to Actually Implement This

Dentago connects to your existing Henry Schein, Kent Express, and Dental Sky accounts and shows you real-time prices from all three in a single search. You don't change anything about your supplier relationships — you simply see all your prices in one place and choose the best one at the point of ordering.

It's free for UK dental practices, takes about 10 minutes to set up, and requires no technical knowledge.

[Compare supplier prices for free →](https://www.dentago.co.uk/onboarding/step1.html)
    `,
  },
  {
    slug: "complete-guide-dental-procurement-uk-practice-managers",
    title: "The Complete Guide to Dental Procurement for UK Practice Managers (2026)",
    description:
      "Everything a UK dental practice manager needs to know about procurement — supplier relationships, price negotiation, catalogue management, and how to save time and money.",
    date: "2026-04-20",
    readTime: "10 min read",
    category: "Practice Management",
    image: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=1200&q=80",
    imageAlt: "Practice manager working at desk in dental clinic",
    keywords: ["dental procurement UK", "dental practice manager procurement", "dental supply management UK", "practice manager dental supplies"],
    content: `
## What Is Dental Procurement?

Dental procurement is the process of sourcing, ordering, and managing all the supplies a dental practice needs to operate — from nitrile gloves and masks to composite resins, local anaesthetics, implants, and infection control products.

For a busy UK dental practice, procurement is a constant, ongoing responsibility. Products run out. Prices change. Suppliers update their catalogues. New products come to market. A practice that manages procurement well saves money, avoids stockouts, and keeps the clinical team focused on patients rather than logistics.

This guide covers everything a UK practice manager needs to know.

## Understanding the UK Dental Supply Market

The UK dental supply market is dominated by a handful of major distributors:

- **Henry Schein** — the largest dental supplier in the world, with strong UK presence and a broad catalogue
- **Kent Express** — a major UK-focused distributor, well known for competitive pricing and fast delivery
- **Dental Sky** — a growing UK supplier known for competitive pricing, particularly on consumables and PPE
- **DHB Dental** — strong on own-brand consumables and PPE
- **Wrights Dental** — established UK supplier with a broad catalogue

Most practices maintain accounts with two to four suppliers. Very few order exclusively from one — and those that do are almost always paying more than they need to.

## How Supplier Pricing Works

Understanding how dental supplier pricing works is essential to managing procurement well.

**List price vs account price.** Every product has a list price, but most practices receive a negotiated account price that is lower. This discount varies by supplier, product category, and your spending volume with that supplier.

**Volume tiers.** Most suppliers operate tiered pricing: the more you order, the lower your unit price. Understanding where your practice sits on each supplier's volume tiers helps you consolidate orders strategically.

**Promotional pricing.** All major UK dental suppliers run promotions — buy X get Y free, percentage off specific categories, seasonal discounts. These promotions are time-limited and not always communicated proactively.

**Price changes.** Dental supply prices fluctuate based on raw material costs, exchange rates (much of dental supply is manufactured in the US, Germany, and Japan), and supplier margin decisions. Assuming the price you paid last quarter is still the best available price is a common and costly mistake.

## Building Your Preferred Product List

One of the most time-saving things a practice manager can do is build and maintain a preferred product list — a standardised list of the exact SKUs your practice uses for each category.

**Why this matters:** Without a preferred product list, the clinical team may order different brands or sizes of the same product from different suppliers at different times, making it impossible to compare costs accurately and making stock management difficult.

**How to build one:** Work with your principal dentist or clinical lead to agree on a preferred product for each category. For most categories, there are two or three clinically equivalent options at different price points. Agree on one, make it the default, and then track its price across suppliers.

## The True Cost of Procurement

The direct cost of dental supplies is visible. The indirect cost — the time spent managing procurement — often isn't counted but is substantial.

A practice manager spending three hours per week on procurement tasks (checking stock, comparing prices across supplier websites, placing orders, reconciling invoices) is spending approximately 150 hours per year on procurement. At an average UK practice manager salary of £28,000 (roughly £14/hour), that's £2,100 of salary cost that isn't directly visible in the supply budget.

Reducing procurement time by 50% through better tooling frees up 75 hours per year — time that can go toward patient experience, marketing, or practice administration.

## Managing Multiple Supplier Accounts

Most practices that use multiple suppliers manage them entirely separately: different logins, different websites, different ordering processes, different invoices. This creates fragmentation that makes comparison and management harder.

**Best practice:** Maintain a simple log of your active supplier accounts — supplier name, account number, account manager contact, current negotiated discount tier, and monthly spend. Review this quarterly.

**Consolidate invoicing where possible.** Some suppliers offer consolidated invoicing if you order frequently. This reduces administrative burden.

**Understand your delivery schedules.** Henry Schein, Kent Express, and Dental Sky all offer next-day delivery on orders placed before a certain cut-off. Knowing each supplier's cut-off time prevents the situation where a product runs out mid-week and can't be restocked until the following day.

## Price Comparison: The Biggest Lever Most Practices Don't Pull

The single highest-impact thing most UK practices can do to reduce supply costs is to systematically compare prices at the point of ordering rather than ordering from a default supplier.

The challenge has always been practicality. Manually logging into three supplier websites, searching for the same product, noting prices, and then placing separate orders is time-consuming. Most practice managers simply don't have capacity to do this for every order.

This is the gap Dentago was built to fill. By connecting to your existing supplier accounts and showing real-time prices from all of them in a single search, Dentago makes comparison effortless. You search once, see every supplier's current price side by side, and order from whichever is cheapest — all from one cart.

## Stock Management Basics

**Set reorder points, not reorder schedules.** Rather than ordering on a fixed schedule (e.g., every Monday), set minimum stock levels for each product. When a product hits the minimum, it's ordered. This prevents both stockouts and overstocking.

**High-use consumables need buffer stock.** Nitrile gloves, masks, and suction tips should always have at least two weeks of buffer stock. These are the items that cause the most disruption when they run out.

**Don't over-stock expensive items.** Composite syringes, bonding agents, and impression materials have shelf lives and tie up cash. Order what you need for four to six weeks, not six months.

## Negotiating With Suppliers

Suppliers expect negotiation. Most practices don't negotiate — which means they're leaving money on the table.

**What actually works:**
- Ask for a price review every 12 months, referencing your annual spend
- Get quotes in writing so you can compare
- Mention competitor pricing — suppliers will often match or beat
- Ask about account manager deals that aren't on the standard pricelist

**What doesn't work:**
- Threatening to leave without intending to — suppliers know
- Negotiating on individual products rather than overall account value
- Negotiating before you have data on what you actually spend

## The Future of Dental Procurement

The dental supply industry is moving toward greater transparency and digitalisation. Practices that adopt price comparison tools, digital ordering platforms, and spend analytics now will be positioned to save significantly more as these tools improve.

Dentago is free for UK dental practices. Connect your existing supplier accounts, and start comparing prices in real time across all your suppliers in one search.

[Set up your free account →](https://www.dentago.co.uk/onboarding/step1.html)
    `,
  },
  {
    slug: "why-dental-practices-spend-4-hours-week-on-procurement",
    title: "Why UK Dental Practices Spend 4 Hours a Week on Procurement (And How to Get That Time Back)",
    description:
      "UK practice managers spend an average of 4 hours per week managing dental supply procurement. Here's why it takes so long, and what practices doing it in under 30 minutes are doing differently.",
    date: "2026-04-20",
    readTime: "5 min read",
    category: "Practice Management",
    image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1200&q=80",
    imageAlt: "Person working on laptop managing procurement",
    keywords: ["dental procurement software UK", "dental supply management software", "save time dental procurement", "dental practice efficiency"],
    content: `
## Four Hours a Week, Every Week

Speak to any UK dental practice manager and the story is the same: procurement takes far too long. Checking stock levels, logging into multiple supplier websites, searching for products, comparing prices (if they compare at all), placing separate orders, and then reconciling multiple invoices at the end of the month.

Four hours per week is conservative. For practices with multiple surgeries, it's often more.

That's 200 hours per year. Five working weeks. Spent on a task that, with the right tools, should take 20 to 30 minutes.

## Why It Takes So Long

The problem isn't that practice managers are slow. It's that the process is genuinely fragmented.

**Multiple supplier logins.** Each supplier has its own website, its own search interface, its own account portal. A practice with four supplier accounts logs in and out four times per order cycle.

**Manual stock checking.** Most practices check physical stock by walking around the storage room or asking the dental nurses. There's no digital record of what's running low until someone notices.

**No price memory.** Supplier websites don't tell you whether the price today is higher or lower than last month. There's no easy way to know if you're getting a good price without actively comparing.

**Separate checkout for each supplier.** Adding items from Henry Schein and Kent Express to the same order isn't possible on their individual platforms. You place two separate orders, get two separate confirmations, two separate deliveries, and two separate invoices.

**Invoice reconciliation.** Matching supplier invoices to orders placed, checking for discrepancies, and coding expenses for the accountant — this administrative tail adds time at the end of every month.

## What Efficient Practices Do Differently

The practices that manage procurement in under 30 minutes per week have typically done three things:

**1. They have a standardised product list.** Rather than allowing the clinical team to order anything from any supplier, they've agreed on a preferred product for each category. This eliminates the decision-making overhead of choosing between five types of composite every order.

**2. They have set reorder points.** Rather than ordering on a schedule, they order when stock hits a minimum level. This means procurement only happens when it needs to, not on a fixed day whether or not it's needed.

**3. They use a comparison tool.** Practices that use a single interface to compare prices across all their suppliers and place all their orders at once save the most time. The search, the comparison, and the checkout all happen in one place.

## The Software Gap in Dental

Most industries have moved to digital procurement platforms. Hospitality, construction, healthcare — buying from multiple suppliers through a single interface is standard.

Dental has been slow to catch up. Practice management software (Dentally, Software of Excellence, Exact) handles clinical records and scheduling, but not supply procurement. The two worlds have stayed separate, which means procurement has remained manual.

This is changing. Dentago connects to your existing supplier accounts — Henry Schein, Kent Express, Dental Sky, and others — and brings their catalogues together into a single search. You search once, see every supplier's real-time price, add everything to one cart, and place all orders simultaneously.

The time saving is significant. A task that takes four hours becomes 20 minutes. A task that requires logging into five different websites requires logging into one.

## What You Get Back

Four hours per week returned to a practice manager means:

- More time for patient experience and practice administration
- More attention to the clinical team's day-to-day needs
- More capacity to focus on the parts of the job that require human judgement

It also typically means better procurement decisions — because when comparison is easy, you actually compare, and when you compare, you spend less.

Dentago is free for UK dental practices. No subscription, no hidden fees, no contracts. You connect the supplier accounts you already have, and the platform handles the rest.

[Get your time back — set up Dentago free →](https://www.dentago.co.uk/onboarding/step1.html)
    `,
  },
  {
    slug: "how-to-compare-dental-supplier-prices-uk-2026",
    title: "How to Compare Dental Supplier Prices in the UK (2026 Guide)",
    description:
      "A practical step-by-step guide to comparing dental supplier prices across Henry Schein, Kent Express, Dental Sky and other UK suppliers — and keeping your supply costs under control.",
    date: "2026-04-20",
    readTime: "5 min read",
    category: "Procurement",
    image: "https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=1200&q=80",
    imageAlt: "Comparing prices on a digital screen",
    keywords: ["compare dental supplier prices UK", "dental price comparison UK", "dental supplies price comparison tool", "best price dental supplies UK"],
    content: `
## Why Price Comparison Matters More Than You Think

For a practice spending £15,000 per year on dental supplies, a consistent 15% saving adds up to £2,250 annually. Over five years, that's £11,250 — enough to fund a significant equipment purchase or several months of marketing.

The practices achieving these savings aren't doing anything exotic. They're simply comparing prices across their existing suppliers at the point of ordering, rather than defaulting to whoever they ordered from last time.

This guide explains exactly how to do it.

## Step 1: Know Your Suppliers

Before you can compare, you need active accounts with multiple suppliers. Most UK practices already have this — typically two to four supplier accounts built up over the years. If you only use one supplier, the first step is to open a free account with at least one alternative.

The main UK dental suppliers are:
- **Henry Schein** — largest range, strong account management
- **Kent Express** — UK-focused, competitive on many categories
- **Dental Sky** — frequently the lowest price on consumables and PPE
- **DHB Dental** — competitive on own-brand products
- **Wrights Dental** — established with a broad general catalogue

## Step 2: Build a Standard Product List

Comparing prices is only useful if you're comparing like-for-like. Create a list of the exact products your practice orders regularly — by SKU or product name, not just category. "Nitrile gloves medium" isn't specific enough. "Dental Sky Smart Blue Nitrile Gloves Medium, Box of 100" is.

A standard product list also makes it easier to track price changes over time and to spot when a supplier has increased their price without announcement.

## Step 3: The Manual Method (And Why It Doesn't Scale)

The traditional way to compare dental supplier prices is:

1. Log in to Henry Schein's website
2. Search for the product
3. Note the price
4. Log out
5. Log in to Kent Express
6. Search for the same product
7. Note the price
8. Repeat for every other supplier
9. Compare your notes
10. Place the order with the cheapest supplier
11. Repeat the process for every other product you need

For a typical order of 15–20 products across three suppliers, this takes 60–90 minutes. Most practice managers don't have that time, which is why most practices don't compare systematically.

## Step 4: The Faster Method

Dentago was built specifically to eliminate steps 1–9 above. By connecting to your existing supplier accounts, it shows you real-time prices from all your suppliers in a single search.

Here's how it works:
1. Search for any product on Dentago
2. See every connected supplier's current price side by side instantly
3. Add to cart from whichever supplier is cheapest
4. Repeat for every product you need
5. Check out once — all orders are placed simultaneously

The process that took 90 minutes takes under 15.

## What to Look For When Comparing

**Don't just compare headline price.** Factor in:
- **Pack size.** £12 for 50 units vs £20 for 100 units — the second is cheaper per unit.
- **Delivery cost.** Some suppliers charge for delivery below a threshold. Factor this in.
- **Delivery time.** If you need something tomorrow, the cheapest supplier that delivers in 3 days isn't the best choice today.
- **Stock availability.** A price is only useful if the product is actually in stock.

Dentago shows pack size, stock status, and delivery information alongside price, so you're comparing the full picture rather than just the headline number.

## Step 5: Track Price Changes Over Time

Supplier prices change. A product that was cheapest on Kent Express in January may now be cheaper on Dental Sky. The practice that checks once and never looks again will eventually be paying more than they need to.

Set a reminder to do a price audit on your top 20 most ordered products once per quarter. Check whether the supplier you're ordering from is still the cheapest for each one.

## Common Mistakes to Avoid

**Ordering everything from one supplier for convenience.** Consolidation is not the same as efficiency. The convenience of one order from one supplier typically costs 10–20% more than ordering each product from the cheapest source.

**Ignoring promotions.** All major UK dental suppliers run promotions that can significantly undercut their standard account pricing. If you're not paying attention to these, you're missing savings opportunities.

**Not passing negotiated prices.** If you negotiate a better price with a supplier on a specific product, make sure that price is actually being applied to your invoices. It's not uncommon for negotiated prices to not transfer correctly to account systems.

**Comparing by brand rather than product.** Two products with different brand names may be clinically identical. Clinical equivalents that are slightly cheaper are worth knowing about — your principal dentist can advise on which substitutions are appropriate for your practice.

## Getting Started Today

The fastest way to start comparing UK dental supplier prices is to set up a free Dentago account. Connect your existing Henry Schein, Kent Express, and Dental Sky accounts, and you'll have real-time price comparison across all of them in a single search from today.

There's no cost, no contract, and no change to your existing supplier relationships.

[Start comparing prices for free →](https://www.dentago.co.uk/onboarding/step1.html)
    `,
  },
];

export function getPost(slug: string): BlogPost | undefined {
  return POSTS.find((p) => p.slug === slug);
}
