import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  'https://wybqjycfpauwlcrqgtfb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5YnFqeWNmcGF1d2xjcnFndGZiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjM2NzM1MywiZXhwIjoyMDkxOTQzMzUzfQ.2SfC2VtZVb61Yy3uqXJe8yHqnFMJfZJWcgnx7xkdLeI'
);

async function main() {
  const { count: totalProducts } = await sb.from('dentago_products').select('*', { count: 'exact', head: true });
  const { count: nullImage } = await sb.from('dentago_products').select('*', { count: 'exact', head: true }).is('image', null);
  const { count: emptyImage } = await sb.from('dentago_products').select('*', { count: 'exact', head: true }).eq('image', '');

  // Supplier products pricing breakdown
  const { count: zeroPrice } = await sb.from('dentago_supplier_products').select('*', { count: 'exact', head: true }).eq('price', 0);
  const { count: totalSP } = await sb.from('dentago_supplier_products').select('*', { count: 'exact', head: true });

  // Counts by supplier
  const { data: bySupplier } = await sb.from('dentago_supplier_products').select('supplier_id, price');
  const counts: Record<string, number> = {};
  const zeroCounts: Record<string, number> = {};
  bySupplier?.forEach((r: any) => {
    counts[r.supplier_id] = (counts[r.supplier_id] || 0) + 1;
    if (!r.price || r.price === 0) zeroCounts[r.supplier_id] = (zeroCounts[r.supplier_id] || 0) + 1;
  });

  const { data: suppliers } = await sb.from('dentago_suppliers').select('id, name');
  const nameMap: Record<string, string> = {};
  suppliers?.forEach((s: any) => nameMap[s.id] = s.name);

  // Products with no supplier pricing at all
  const { data: allProducts } = await sb.from('dentago_products').select('id, name').limit(700);
  const productIds = new Set(allProducts?.map((p: any) => p.id));
  const { data: spProducts } = await sb.from('dentago_supplier_products').select('product_id');
  const coveredIds = new Set(spProducts?.map((r: any) => r.product_id));
  const uncoveredCount = [...productIds].filter(id => !coveredIds.has(id)).length;

  // Dental Sky specifically - supplier_id for DS
  const dsSupplier = suppliers?.find((s: any) => s.name === 'Dental Sky');
  const dsCount = dsSupplier ? (counts[dsSupplier.id] || 0) : 0;
  const dsZero = dsSupplier ? (zeroCounts[dsSupplier.id] || 0) : 0;

  console.log('=== Product Catalogue ===');
  console.log('Total products:', totalProducts);
  console.log('Products with null image:', nullImage);
  console.log('Products with empty image:', emptyImage);
  console.log('Products with NO supplier pricing:', uncoveredCount);
  console.log('\n=== Supplier Pricing Coverage ===');
  console.log('Total supplier_product rows:', totalSP);
  console.log('Rows with £0 price:', zeroPrice);
  console.log('\nBreakdown by supplier (total | £0):');
  Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([id, c]) => {
      const z = zeroCounts[id] || 0;
      console.log(`  ${(nameMap[id] || id).padEnd(25)} ${String(c).padStart(4)} total | ${String(z).padStart(4)} at £0`);
    });
  console.log(`\nDental Sky real prices: ${dsCount - dsZero} / ${dsCount}`);
}

main().catch(console.error);
