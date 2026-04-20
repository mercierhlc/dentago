export type Supplier = {
  name: string;
  price: number;
  stock: boolean;
  delivery: string;
  sku: string;
  packSize?: string;
};

export type Product = {
  id: number;
  name: string;
  brand: string;
  category: string;
  image: string;
  description: string;
  packSize: string;
  specs: { label: string; value: string }[];
  suppliers: Supplier[];
  similars: number[];
};

// Real product images sourced from supplier/manufacturer websites
const IMG = {
  // PPE
  gloves:      "https://www.dentalsky.com/media/catalog/product/cache/f85fa63785494855da584f973c145c72/s/m/smart-blue-nitrile-gloves-box-and-glove_2.jpg",
  masks:       "https://www.dentalsky.com/media/catalog/product/cache/f85fa63785494855da584f973c145c72/s/m/smart-masks-type-iir-blue.jpg",
  ffp2:        "https://www.dentalsky.com/media/catalog/product/cache/14d2ea3e23047d13d96b1e8d21dd59b1/2/0/205-0038.png",
  // Anaesthetics
  septanest:   "https://assets.henryschein.com/1022843_UK_Front_01_s.png",
  lignospan:   "https://www.septodont.co.uk/wp-content/uploads/sites/12/2022/12/lignospan-975b.png?x50508",
  ultracaine:  "https://assets.henryschein.com/1022843_UK_Front_01_s.png",
  // Composites / bonding / GIC
  filtek:      "https://www.clinicalresearchdental.com/cdn/shop/products/Filtek_Z250_Universal_Restorative_syringe_535x.png?v=1592836155",
  aquasil:     "https://empiredentalsupplies.com/cdn/shop/products/getImage_2bc80015-6657-4cb0-8e2e-746a3b579850.jpg?v=1697050272&width=500",
  ketac:       "https://www.dentrealstore.com/cdn/shop/files/ketac-molar-easymix-kit-glass-ionomer-filling-material-277669.jpg?v=1733147607&width=1200",
  optibond:    "https://www.kerrdental.com/en-uk/sites/default/files/styles/product_-_main_image/public/35265%252025881E%252025881-OptiBond-FL-primer-2022.jpeg?itok=lS6x_pkd",
  fuji:        "https://www.dentalsky.com/media/catalog/product/cache/f85fa63785494855da584f973c145c72/a/b/ab295_web_2.jpg",
  clearfil:    "https://kuraraydental.com/wp-content/uploads/2018/06/8.jpg",
  // Endodontics
  protaper:    "https://www.dentsplysirona.com/content/dam/master/ecom/product-procedure-brand-categories/endodontics/product-categories/full-solutions/protaper-gold-solution/images/END-product-image-ProTaper-Gold-FINISHING-Files-all.jpg",
  waveone:     "https://www.dentalsky.com/media/catalog/product/cache/2f515a8b3a0f63eb4e8555dae38c3947/2/5/253-0162.jpg",
  mta:         "https://www.dentrealstore.com/cdn/shop/files/pro-root-mta-root-canal-repair-white-10x05-gr-636087.jpg?v=1733213274&width=1200",
  calasept:    "https://directadental.com/wp-content/uploads/2024/09/CalaseptPlus_05-2023_Startsida-scaled.jpg",
  // Instruments
  curette:     "https://www.skydentalsupply.com/picts/products/tnw800-hu-friedyoctagonal2a.webp",
  matrix:      "https://js-davis.co.uk/wp-content/uploads/2022/03/tofflemire-matrix-band-300x300.jpg",
  scalpel:     "https://www.safcodental.com/media/catalog/product/p/f/pflma.jpg?optimize=medium&fit=bounds&height=700&width=700&canvas=700:700",
  // Infection control
  optim33:     "https://assets.scican.com/images/cleaners-disinfectants/optim-33-tb/optim33tb_banner_US_updated.png",
  cavicide:    "https://www.spaorder.com/cdn/shop/files/ae3ab6bd616d04b64b21a9514dad15f918fa686802a50c47a1411f2b949ea5d8.jpg?v=1761342452&width=3840",
  pouches:     "https://www.dentalsky.com/media/catalog/product/cache/214152a3c6dac558ee760630bc9186f5/4/-/4-964-box.jpg",
  // Implants
  blx:         "https://assetsproduction.spotimplant.com/media/implant-image/straumann-blx-regular-base-image-13706-6c228e.png",
  nobelactive: "https://assetsproduction.spotimplant.com/media/implant-image/nobel-biocare-nobelactive-image-5277-d26c7f.jpeg",
  biohorizons: "https://assetsproduction.spotimplant.com/media/implant-image/biohorizons-tapered-internal-image-2181-4149a8.jpeg",
  // Diagnostics
  vistascan:   "https://www.dentrealstore.com/cdn/shop/files/vistascan-nano-easy-phosphor-plate-scanner-0-2-804293.jpg?v=1733214352&width=1200",
  rvg:         "https://universadent.com/wp-content/uploads/2020/03/rvg-62003.jpg",
  // Orthodontics
  transbond:   "https://ansondental.com/cdn/shop/products/Transbond_XT_Kit_1024x1024.jpg?v=1537284184",
  brackets:    "https://www.dentalsky.com/media/catalog/product/cache/959ed9ba877961865ee22b133d4d28fc/8/0/80-669.jpg",
};

export const PRODUCTS: Product[] = [
  // ── PPE ──────────────────────────────────────────────────────────────────
  {
    id: 1, name: "Nitrile Examination Gloves — Large (Box of 100)", brand: "Cranberry", category: "PPE",
    image: IMG.gloves,
    packSize: "Box of 100",
    description: "Cranberry nitrile powder-free examination gloves offer superior puncture resistance and tactile sensitivity. AQL 1.5 rated, CE marked for medical use. Suitable for all dental procedures.",
    specs: [
      { label: "Size", value: "Large" },
      { label: "Quantity", value: "100 per box" },
      { label: "Material", value: "Nitrile" },
      { label: "Powder", value: "Powder Free" },
      { label: "AQL Rating", value: "1.5" },
      { label: "Colour", value: "Blue" },
      { label: "Certification", value: "CE Marked, EN455" },
    ],
    suppliers: [
      { name: "Dental Sky",   price: 4.85,  stock: true,  delivery: "Next day",  sku: "DS-NG-L100",  packSize: "Box of 100" },
      { name: "DHB",          price: 4.95,  stock: false, delivery: "5–7 days",  sku: "DHB-N100L",   packSize: "Box of 100" },
      { name: "Kent Express", price: 5.20,  stock: true,  delivery: "2–3 days",  sku: "KE-7821",     packSize: "Box of 100" },
      { name: "Total Dental", price: 5.30,  stock: true,  delivery: "2–3 days",  sku: "TD-NGL100",   packSize: "Box of 100" },
      { name: "Henry Schein", price: 5.65,  stock: true,  delivery: "Next day",  sku: "HS-401234",   packSize: "Box of 100" },
    ],
    similars: [2, 3, 4],
  },
  {
    id: 2, name: "Nitrile Examination Gloves — Medium (Box of 100)", brand: "Cranberry", category: "PPE",
    image: IMG.gloves,
    packSize: "Box of 100",
    description: "Cranberry nitrile powder-free examination gloves in medium size. Same premium quality as our large variant — exceptional barrier protection with a comfortable, snug fit for precise dental work.",
    specs: [
      { label: "Size", value: "Medium" },
      { label: "Quantity", value: "100 per box" },
      { label: "Material", value: "Nitrile" },
      { label: "Powder", value: "Powder Free" },
      { label: "AQL Rating", value: "1.5" },
      { label: "Colour", value: "Blue" },
      { label: "Certification", value: "CE Marked, EN455" },
    ],
    suppliers: [
      { name: "Dental Sky",   price: 4.85,  stock: true,  delivery: "Next day",  sku: "DS-NG-M100",  packSize: "Box of 100" },
      { name: "Amalgadent",   price: 4.90,  stock: true,  delivery: "Next day",  sku: "AM-NITRM100", packSize: "Box of 100" },
      { name: "Kent Express", price: 5.10,  stock: true,  delivery: "2–3 days",  sku: "KE-7820",     packSize: "Box of 100" },
      { name: "Henry Schein", price: 5.60,  stock: true,  delivery: "Next day",  sku: "HS-401233",   packSize: "Box of 100" },
      { name: "Nuvelo",       price: 5.75,  stock: false, delivery: "3–5 days",  sku: "NV-NGLM100",  packSize: "Box of 100" },
    ],
    similars: [1, 3, 4],
  },
  {
    id: 3, name: "Type IIR Surgical Face Masks — Box of 50", brand: "Medicom", category: "PPE",
    image: IMG.masks,
    packSize: "Box of 50",
    description: "Medicom SafeMask Type IIR surgical face masks provide effective bacterial filtration (BFE ≥98%) and splash resistance. Fluid resistant outer layer, soft inner lining. Individually wrapped, latex-free.",
    specs: [
      { label: "Type", value: "Type IIR" },
      { label: "Quantity", value: "50 per box" },
      { label: "BFE", value: "≥98%" },
      { label: "Splash Resistant", value: "Yes" },
      { label: "Latex Free", value: "Yes" },
      { label: "Certification", value: "EN14683:2019" },
    ],
    suppliers: [
      { name: "Clark Dental",     price: 3.20,  stock: true,  delivery: "Next day",  sku: "CD-MASK50",   packSize: "Box of 50" },
      { name: "Dental Sky",       price: 3.45,  stock: true,  delivery: "Next day",  sku: "DS-MASK50",   packSize: "Box of 50" },
      { name: "Amalgadent",       price: 3.50,  stock: true,  delivery: "Next day",  sku: "AM-FMASK50",  packSize: "Box of 50" },
      { name: "Kent Express",     price: 3.65,  stock: true,  delivery: "2–3 days",  sku: "KE-5511",     packSize: "Box of 50" },
      { name: "Henry Schein",     price: 3.80,  stock: true,  delivery: "Next day",  sku: "HS-305021",   packSize: "Box of 50" },
      { name: "Patterson Dental", price: 3.90,  stock: false, delivery: "4–5 days",  sku: "PAT-FM50",    packSize: "Box of 50" },
    ],
    similars: [4, 1, 2],
  },
  {
    id: 4, name: "FFP2 Respirator Masks — Box of 20", brand: "3M", category: "PPE",
    image: IMG.ffp2,
    packSize: "Box of 20",
    description: "3M FFP2 respirator masks filter at least 94% of airborne particles. Ideal for aerosol-generating procedures. Adjustable nose clip, low breathing resistance, individually packed.",
    specs: [
      { label: "Rating", value: "FFP2" },
      { label: "Quantity", value: "20 per box" },
      { label: "Filtration", value: "≥94% NaCl/oil aerosol" },
      { label: "Exhalation Valve", value: "No" },
      { label: "Certification", value: "EN149:2001+A1:2009" },
    ],
    suppliers: [
      { name: "Medentra",         price: 12.50, stock: true,  delivery: "Next day",  sku: "MED-FFP220",  packSize: "Box of 20" },
      { name: "Dental Sky",       price: 13.10, stock: true,  delivery: "Next day",  sku: "DS-FFP220",   packSize: "Box of 20" },
      { name: "Henry Schein",     price: 14.80, stock: true,  delivery: "Next day",  sku: "HS-3MFFP2",   packSize: "Box of 20" },
      { name: "J&S Davis",        price: 14.95, stock: false, delivery: "5–7 days",  sku: "JSD-FFP20",   packSize: "Box of 20" },
    ],
    similars: [3, 1, 2],
  },

  // ── ANAESTHETICS ─────────────────────────────────────────────────────────
  {
    id: 5, name: "Septanest 4% Articaine + Epinephrine 1:100,000 — 50 Cartridges", brand: "Septodont", category: "Anaesthetics",
    image: IMG.septanest,
    packSize: "50 cartridges × 1.7ml",
    description: "Septanest is the UK's leading dental anaesthetic. 4% articaine with 1:100,000 epinephrine provides rapid onset and profound anaesthesia. Suitable for infiltration and nerve block in adults and children over 4 years.",
    specs: [
      { label: "Active Ingredient", value: "4% Articaine HCl" },
      { label: "Vasoconstrictor", value: "Epinephrine 1:100,000" },
      { label: "Quantity", value: "50 cartridges × 1.7ml" },
      { label: "Onset", value: "2–3 minutes" },
      { label: "Duration", value: "60–75 min (pulpal)" },
      { label: "pH", value: "3.5–4.5" },
    ],
    suppliers: [
      { name: "Henry Schein",     price: 28.40, stock: true,  delivery: "Next day",  sku: "HS-189023",   packSize: "50 cartridges" },
      { name: "Kent Express",     price: 29.80, stock: true,  delivery: "2–3 days",  sku: "KE-4421",     packSize: "50 cartridges" },
      { name: "Dental Directory", price: 30.50, stock: true,  delivery: "2–3 days",  sku: "DD-SEPT50",   packSize: "50 cartridges" },
      { name: "Dental Sky",       price: 31.20, stock: false, delivery: "3–5 days",  sku: "DS-SEP50",    packSize: "50 cartridges" },
      { name: "Clark Dental",     price: 31.90, stock: true,  delivery: "Next day",  sku: "CD-SEPT50",   packSize: "50 cartridges" },
    ],
    similars: [6, 7],
  },
  {
    id: 6, name: "Lidocaine 2% + Epinephrine 1:80,000 — 50 Cartridges", brand: "Lignospan", category: "Anaesthetics",
    image: IMG.lignospan,
    packSize: "50 cartridges × 2.2ml",
    description: "Lignospan Standard provides reliable dental anaesthesia with 2% lidocaine HCl and 1:80,000 epinephrine. The gold standard in dental anaesthetics — fast onset, long duration, well-tolerated.",
    specs: [
      { label: "Active Ingredient", value: "2% Lidocaine HCl" },
      { label: "Vasoconstrictor", value: "Epinephrine 1:80,000" },
      { label: "Quantity", value: "50 cartridges × 2.2ml" },
      { label: "Onset", value: "3–5 minutes" },
      { label: "Duration", value: "60–90 min (pulpal)" },
    ],
    suppliers: [
      { name: "Wrights",          price: 22.10, stock: true,  delivery: "Next day",  sku: "WR-LIGN50",   packSize: "50 cartridges" },
      { name: "Kent Express",     price: 23.40, stock: true,  delivery: "2–3 days",  sku: "KE-4400",     packSize: "50 cartridges" },
      { name: "Henry Schein",     price: 24.90, stock: true,  delivery: "Next day",  sku: "HS-LIGN50",   packSize: "50 cartridges" },
      { name: "Dental Directory", price: 25.50, stock: false, delivery: "4–5 days",  sku: "DD-LIGN50",   packSize: "50 cartridges" },
    ],
    similars: [5, 7],
  },
  {
    id: 7, name: "Ultracaine D-S Forte 4% Articaine — 50 Cartridges", brand: "Sanofi", category: "Anaesthetics",
    image: IMG.ultracaine,
    packSize: "50 cartridges × 1.7ml",
    description: "Ultracaine D-S Forte by Sanofi contains 4% articaine with 1:100,000 adrenaline. Delivers reliable, fast-acting anaesthesia. Suitable for all conventional dental treatments requiring deep anaesthesia.",
    specs: [
      { label: "Active Ingredient", value: "4% Articaine HCl" },
      { label: "Vasoconstrictor", value: "Adrenaline 1:100,000" },
      { label: "Quantity", value: "50 cartridges × 1.7ml" },
      { label: "Onset", value: "2–4 minutes" },
    ],
    suppliers: [
      { name: "Amalgadent",       price: 27.80, stock: true,  delivery: "Next day",  sku: "AM-ULTRA50",  packSize: "50 cartridges" },
      { name: "Clark Dental",     price: 28.60, stock: true,  delivery: "Next day",  sku: "CD-ULTRA50",  packSize: "50 cartridges" },
      { name: "Henry Schein",     price: 29.90, stock: true,  delivery: "Next day",  sku: "HS-ULTRA50",  packSize: "50 cartridges" },
      { name: "Patterson Dental", price: 30.40, stock: true,  delivery: "3–4 days",  sku: "PAT-ULTRA50", packSize: "50 cartridges" },
    ],
    similars: [5, 6],
  },

  // ── CONSUMABLES ──────────────────────────────────────────────────────────
  {
    id: 8, name: "3M ESPE Filtek Z250 Universal Restorative — A1 Syringe 4g", brand: "3M ESPE", category: "Consumables",
    image: IMG.filtek,
    packSize: "4g syringe",
    description: "Filtek Z250 is a proven universal restorative composite with excellent polishability and marginal integrity. The micro-hybrid formulation provides outstanding strength and aesthetics for anterior and posterior restorations.",
    specs: [
      { label: "Shade", value: "A1" },
      { label: "Weight", value: "4g syringe" },
      { label: "Type", value: "Micro-hybrid composite" },
      { label: "Radiopacity", value: "Yes (260% Al)" },
      { label: "Shrinkage", value: "1.9% volumetric" },
      { label: "Application", value: "Anterior & posterior" },
    ],
    suppliers: [
      { name: "Wrights",      price: 17.90, stock: true,  delivery: "Next day",  sku: "WR-3MZ250A1", packSize: "4g syringe" },
      { name: "Henry Schein", price: 18.75, stock: true,  delivery: "Next day",  sku: "HS-701892",   packSize: "4g syringe" },
      { name: "Kent Express", price: 19.40, stock: true,  delivery: "2–3 days",  sku: "KE-3M-A1",   packSize: "4g syringe" },
      { name: "Nuvelo",       price: 20.10, stock: false, delivery: "5–7 days",  sku: "NV-Z250A1",  packSize: "4g syringe" },
    ],
    similars: [10, 12, 11, 13],
  },
  {
    id: 9, name: "Dentsply Aquasil Ultra+ LV Regular Set — 50ml Cartridge", brand: "Dentsply Sirona", category: "Consumables",
    image: IMG.aquasil,
    packSize: "50ml cartridge",
    description: "Aquasil Ultra+ is a premium vinyl polysiloxane (VPS) impression material offering exceptional dimensional accuracy and hydrophilicity. Low viscosity for detail reproduction. Regular set time for standard procedures.",
    specs: [
      { label: "Viscosity", value: "Light / Monophase" },
      { label: "Volume", value: "50ml cartridge" },
      { label: "Set Time", value: "Regular (4.5 min)" },
      { label: "Working Time", value: "2 min 15 sec" },
      { label: "Shore A Hardness", value: "48" },
      { label: "Tear Strength", value: "3200 g/cm" },
    ],
    suppliers: [
      { name: "DHB",              price: 41.80, stock: true,  delivery: "2–3 days",  sku: "DHB-AQU50",  packSize: "50ml cartridge" },
      { name: "Henry Schein",     price: 42.60, stock: true,  delivery: "Next day",  sku: "HS-AQU-LV",  packSize: "50ml cartridge" },
      { name: "Dental Sky",       price: 44.10, stock: true,  delivery: "2–3 days",  sku: "DS-AQULV",   packSize: "50ml cartridge" },
      { name: "Dental Directory", price: 45.20, stock: true,  delivery: "3–4 days",  sku: "DD-AQULV",   packSize: "50ml cartridge" },
    ],
    similars: [8, 10, 12],
  },
  {
    id: 10, name: "Ketac Molar Easymix GIC — A3 Capsules x 50", brand: "3M ESPE", category: "Consumables",
    image: IMG.ketac,
    packSize: "50 capsules",
    description: "Ketac Molar Easymix is a high-strength glass ionomer restorative for posterior teeth. Self-adhesive, fluoride releasing, and biocompatible. Pre-dosed capsules ensure consistent mixing and reduce waste.",
    specs: [
      { label: "Shade", value: "A3" },
      { label: "Quantity", value: "50 capsules" },
      { label: "Type", value: "Glass ionomer (GIC)" },
      { label: "Fluoride Release", value: "Yes" },
      { label: "Self-Adhesive", value: "Yes" },
      { label: "Application", value: "Posterior restorations" },
    ],
    suppliers: [
      { name: "Kent Express",     price: 54.20, stock: true,  delivery: "2–3 days",  sku: "KE-KETAM50",  packSize: "50 capsules" },
      { name: "Henry Schein",     price: 56.80, stock: true,  delivery: "Next day",  sku: "HS-KETAC50",  packSize: "50 capsules" },
      { name: "J&S Davis",        price: 57.40, stock: false, delivery: "5–7 days",  sku: "JSD-KM50",    packSize: "50 capsules" },
      { name: "Clark Dental",     price: 58.90, stock: true,  delivery: "Next day",  sku: "CD-KETAC50",  packSize: "50 capsules" },
    ],
    similars: [12, 8, 11],
  },
  {
    id: 11, name: "Optibond FL Universal Bonding Agent — 4.5ml", brand: "Kerr", category: "Consumables",
    image: IMG.optibond,
    packSize: "4.5ml primer + 4ml adhesive",
    description: "Optibond FL is the gold standard three-bottle bonding system, widely regarded as the benchmark for clinical bonding performance. Proven over 20 years in clinical studies. Universal compatibility with all composites.",
    specs: [
      { label: "Volume", value: "4.5ml primer + 4ml adhesive" },
      { label: "System", value: "Three-bottle (etch-and-rinse)" },
      { label: "Bond Strength", value: ">30 MPa" },
      { label: "Filler Content", value: "15 wt% (adhesive)" },
      { label: "Cure", value: "Light cure" },
    ],
    suppliers: [
      { name: "Trycare",          price: 24.60, stock: true,  delivery: "Next day",  sku: "TC-OPTFL45",  packSize: "4.5ml + 4ml kit" },
      { name: "Wrights",          price: 25.40, stock: true,  delivery: "Next day",  sku: "WR-OPTFL",    packSize: "4.5ml + 4ml kit" },
      { name: "Henry Schein",     price: 26.80, stock: true,  delivery: "Next day",  sku: "HS-OPTFL45",  packSize: "4.5ml + 4ml kit" },
      { name: "Medentra",         price: 27.20, stock: true,  delivery: "2–3 days",  sku: "MED-OPTFL",   packSize: "4.5ml + 4ml kit" },
      { name: "Total Dental",     price: 28.90, stock: false, delivery: "4–5 days",  sku: "TD-OPTFL45",  packSize: "4.5ml + 4ml kit" },
    ],
    similars: [13, 8, 10],
  },
  {
    id: 12, name: "Fuji IX GP Extra GIC Powder/Liquid — A2", brand: "GC", category: "Consumables",
    image: IMG.fuji,
    packSize: "15g powder + 6.8ml liquid",
    description: "GC Fuji IX GP Extra is a high-strength glass ionomer cement with improved compression strength and surface hardness. Ideal for core build-up, Class II restorations, and posterior stress-bearing areas.",
    specs: [
      { label: "Shade", value: "A2" },
      { label: "Format", value: "Powder + liquid" },
      { label: "Type", value: "High-strength GIC" },
      { label: "Compressive Strength", value: "270 MPa" },
      { label: "Fluoride Release", value: "Yes" },
    ],
    suppliers: [
      { name: "Dental Directory", price: 18.50, stock: true,  delivery: "2–3 days",  sku: "DD-FUJIA2",   packSize: "15g + 6.8ml" },
      { name: "Amalgadent",       price: 19.20, stock: true,  delivery: "Next day",  sku: "AM-FUJIX",    packSize: "15g + 6.8ml" },
      { name: "Henry Schein",     price: 20.40, stock: true,  delivery: "Next day",  sku: "HS-FUJIA2",   packSize: "15g + 6.8ml" },
      { name: "Patterson Dental", price: 21.10, stock: true,  delivery: "3–4 days",  sku: "PAT-FUJI",    packSize: "15g + 6.8ml" },
    ],
    similars: [10, 8, 13],
  },
  {
    id: 13, name: "Clearfil SE Bond 2 — 6ml + 5ml Kit", brand: "Kuraray", category: "Consumables",
    image: IMG.clearfil,
    packSize: "6ml primer + 5ml bond",
    description: "Clearfil SE Bond 2 is a two-step self-etch bonding system renowned for its outstanding clinical performance. MDP monomer ensures exceptional bond strength to both enamel and dentine without separate etching.",
    specs: [
      { label: "Contents", value: "6ml primer + 5ml bond" },
      { label: "System", value: "Two-step self-etch" },
      { label: "Bond Strength (dentin)", value: "35 MPa" },
      { label: "MDP Monomer", value: "Yes" },
      { label: "Cure", value: "Light cure" },
    ],
    suppliers: [
      { name: "Medentra",     price: 31.50, stock: true,  delivery: "Next day",  sku: "MED-CSE2",    packSize: "6ml + 5ml kit" },
      { name: "Kent Express", price: 32.80, stock: true,  delivery: "2–3 days",  sku: "KE-CSE2",     packSize: "6ml + 5ml kit" },
      { name: "Henry Schein", price: 34.90, stock: true,  delivery: "Next day",  sku: "HS-CLSEB2",   packSize: "6ml + 5ml kit" },
    ],
    similars: [11, 8, 12],
  },

  // ── ENDODONTICS ──────────────────────────────────────────────────────────
  {
    id: 14, name: "ProTaper Gold Rotary Files — F1 25mm (6 pcs)", brand: "Dentsply Sirona", category: "Endodontics",
    image: IMG.protaper,
    packSize: "6 files",
    description: "ProTaper Gold combines gold metallurgy with the proven progressive-taper design for superior flexibility and fracture resistance. Thermally-treated NiTi provides enhanced cyclic fatigue resistance in curved canals.",
    specs: [
      { label: "File Type", value: "F1 (Finishing)" },
      { label: "Length", value: "25mm" },
      { label: "Quantity", value: "6 files" },
      { label: "Taper", value: "Progressive 0.07–0.05" },
      { label: "Alloy", value: "Gold thermally treated NiTi" },
      { label: "Tip Size", value: "#20" },
    ],
    suppliers: [
      { name: "Trycare",      price: 32.50, stock: true,  delivery: "Next day",  sku: "TC-PTG-F1",   packSize: "6 files" },
      { name: "DMI",          price: 33.10, stock: false, delivery: "5–7 days",  sku: "DMI-PTGF1",   packSize: "6 files" },
      { name: "Kent Express", price: 34.00, stock: true,  delivery: "2–3 days",  sku: "KE-8811",     packSize: "6 files" },
      { name: "Henry Schein", price: 35.60, stock: true,  delivery: "Next day",  sku: "HS-PTG-F1",   packSize: "6 files" },
    ],
    similars: [15, 16, 17],
  },
  {
    id: 15, name: "WaveOne Gold Primary — 25mm (3 pcs)", brand: "Dentsply Sirona", category: "Endodontics",
    image: IMG.waveone,
    packSize: "3 files",
    description: "WaveOne Gold Primary is a single-file reciprocating system for shaping most root canals in a single instrument. Gold thermal treatment provides enhanced flexibility. Reverse-cutting safety tip reduces procedural errors.",
    specs: [
      { label: "File Type", value: "Primary" },
      { label: "Length", value: "25mm" },
      { label: "Quantity", value: "3 files" },
      { label: "Motion", value: "Reciprocating" },
      { label: "Taper", value: "Variable 0.08–0.05" },
      { label: "Tip Size", value: "#25" },
    ],
    suppliers: [
      { name: "Clark Dental", price: 28.40, stock: true,  delivery: "Next day",  sku: "CD-WOG-P25",  packSize: "3 files" },
      { name: "Trycare",      price: 29.10, stock: true,  delivery: "Next day",  sku: "TC-WOG-P",    packSize: "3 files" },
      { name: "Henry Schein", price: 30.80, stock: true,  delivery: "Next day",  sku: "HS-WOGP25",   packSize: "3 files" },
      { name: "Nuvelo",       price: 31.50, stock: true,  delivery: "2–3 days",  sku: "NV-WOG25",    packSize: "3 files" },
    ],
    similars: [14, 16, 17],
  },
  {
    id: 16, name: "Mineral Trioxide Aggregate (MTA) — 0.5g x 5 sachets", brand: "Dentsply Tulsa", category: "Endodontics",
    image: IMG.mta,
    packSize: "5 × 0.5g sachets",
    description: "ProRoot MTA is the gold standard for vital pulp therapy, perforation repair, and apexification. Excellent biocompatibility and sealing ability. Sets in the presence of moisture.",
    specs: [
      { label: "Quantity", value: "5 × 0.5g sachets" },
      { label: "Composition", value: "Calcium silicate" },
      { label: "Setting Time", value: "~3 hours" },
      { label: "pH", value: "12.5" },
      { label: "Radiopacity", value: "Yes" },
    ],
    suppliers: [
      { name: "DHB",          price: 42.30, stock: true,  delivery: "2–3 days",  sku: "DHB-MTA5",    packSize: "5 sachets" },
      { name: "Wrights",      price: 43.80, stock: true,  delivery: "Next day",  sku: "WR-MTA5",     packSize: "5 sachets" },
      { name: "Henry Schein", price: 45.90, stock: true,  delivery: "Next day",  sku: "HS-MTA5",     packSize: "5 sachets" },
    ],
    similars: [17, 14, 15],
  },
  {
    id: 17, name: "Calasept Plus Calcium Hydroxide — 1.5ml Syringe x 4", brand: "Speident", category: "Endodontics",
    image: IMG.calasept,
    packSize: "4 × 1.5ml syringes",
    description: "Calasept Plus is a pure calcium hydroxide paste in a water-soluble base for intracanal dressing. Radio-opaque, bactericidal, ready-to-use syringes for convenient and precise canal dressing.",
    specs: [
      { label: "Quantity", value: "4 × 1.5ml syringes" },
      { label: "Base", value: "Water-soluble" },
      { label: "pH", value: ">12" },
      { label: "Radiopaque", value: "Yes" },
      { label: "Needles Included", value: "Yes" },
    ],
    suppliers: [
      { name: "Amalgadent",       price: 8.40,  stock: true,  delivery: "Next day",  sku: "AM-CALA4",    packSize: "4 syringes" },
      { name: "Dental Directory", price: 8.90,  stock: true,  delivery: "2–3 days",  sku: "DD-CALA4",    packSize: "4 syringes" },
      { name: "Kent Express",     price: 9.20,  stock: true,  delivery: "2–3 days",  sku: "KE-CALA4",    packSize: "4 syringes" },
      { name: "Henry Schein",     price: 9.80,  stock: false, delivery: "4–5 days",  sku: "HS-CALA4",    packSize: "4 syringes" },
    ],
    similars: [16, 14, 15],
  },

  // ── INSTRUMENTS ──────────────────────────────────────────────────────────
  {
    id: 18, name: "Hu-Friedy Gracey Curette — SG1/2 (Standard)", brand: "Hu-Friedy", category: "Instruments",
    image: IMG.curette,
    packSize: "Single instrument",
    description: "Hu-Friedy SG1/2 Gracey Curettes are the industry standard for subgingival scaling and root planing. Precision-ground cutting edges, balanced weight, and proven IMS handle ensure clinical excellence and longevity.",
    specs: [
      { label: "Pattern", value: "SG1/2 (anterior)" },
      { label: "Handle", value: "Standard, round" },
      { label: "Material", value: "German stainless steel" },
      { label: "Sharpenable", value: "Yes" },
      { label: "Sterilisable", value: "Autoclavable" },
    ],
    suppliers: [
      { name: "Clark Dental",     price: 18.50, stock: true,  delivery: "Next day",  sku: "CD-HFSG12",   packSize: "Single" },
      { name: "J&S Davis",        price: 19.20, stock: true,  delivery: "2–3 days",  sku: "JSD-SG12",    packSize: "Single" },
      { name: "Trycare",          price: 19.80, stock: true,  delivery: "Next day",  sku: "TC-SG12",     packSize: "Single" },
      { name: "Henry Schein",     price: 21.40, stock: true,  delivery: "Next day",  sku: "HS-HFSG12",   packSize: "Single" },
      { name: "Patterson Dental", price: 22.10, stock: true,  delivery: "3–4 days",  sku: "PAT-SG12",    packSize: "Single" },
    ],
    similars: [19, 20],
  },
  {
    id: 19, name: "Stainless Steel Matrix Band — Tofflemire 0.035mm (Pack of 12)", brand: "Ivory", category: "Instruments",
    image: IMG.matrix,
    packSize: "Pack of 12",
    description: "Ivory stainless steel Tofflemire matrix bands for use with universal retainers. 0.035mm gauge provides the ideal combination of rigidity and adaptability. Anatomically contoured for natural contact points.",
    specs: [
      { label: "Gauge", value: "0.035mm" },
      { label: "Quantity", value: "12 bands" },
      { label: "Material", value: "Stainless steel" },
      { label: "Compatible", value: "Universal Tofflemire retainer" },
    ],
    suppliers: [
      { name: "Dental Sky",   price: 2.40,  stock: true,  delivery: "Next day",  sku: "DS-MBTOFF12", packSize: "Pack of 12" },
      { name: "Amalgadent",   price: 2.60,  stock: true,  delivery: "Next day",  sku: "AM-TOFF12",   packSize: "Pack of 12" },
      { name: "Kent Express", price: 2.80,  stock: true,  delivery: "2–3 days",  sku: "KE-TOFF12",   packSize: "Pack of 12" },
      { name: "DMI",          price: 3.10,  stock: true,  delivery: "2–3 days",  sku: "DMI-TOFF12",  packSize: "Pack of 12" },
    ],
    similars: [18, 20],
  },
  {
    id: 20, name: "Bard Parker Scalpel Handle — No. 3", brand: "BD", category: "Instruments",
    image: IMG.scalpel,
    packSize: "Single handle",
    description: "BD Bard-Parker No. 3 scalpel handle is the industry standard for oral surgical procedures. Knurled grip for secure handling, accepts No. 10, 11, 12, 15 blades. Autoclavable stainless steel construction.",
    specs: [
      { label: "Handle No.", value: "No. 3" },
      { label: "Compatible Blades", value: "10, 11, 12, 15" },
      { label: "Material", value: "Stainless steel" },
      { label: "Sterilisable", value: "Autoclavable" },
    ],
    suppliers: [
      { name: "Wrights",      price: 4.90,  stock: true,  delivery: "Next day",  sku: "WR-BP3",      packSize: "Single" },
      { name: "Medentra",     price: 5.20,  stock: true,  delivery: "Next day",  sku: "MED-BP3",     packSize: "Single" },
      { name: "Henry Schein", price: 5.80,  stock: true,  delivery: "Next day",  sku: "HS-BP3",      packSize: "Single" },
    ],
    similars: [18, 19],
  },

  // ── INFECTION CONTROL ────────────────────────────────────────────────────
  {
    id: 21, name: "Optim 33 TB Surface Disinfectant Wipes — Tub of 160", brand: "SciCan", category: "Infection Control",
    image: IMG.optim33,
    packSize: "Tub of 160 wipes",
    description: "Optim 33 TB wipes provide fast, effective surface disinfection in just 1 minute contact time against bacteria, viruses, and TB. Hospital-grade, alcohol-free formula. Safe on most dental surfaces including chairs and screens.",
    specs: [
      { label: "Quantity", value: "160 wipes per tub" },
      { label: "Contact Time", value: "1 minute" },
      { label: "Spectrum", value: "Bactericidal, virucidal, TB" },
      { label: "Alcohol Content", value: "Alcohol-free" },
      { label: "Surface Safe", value: "Yes (most materials)" },
    ],
    suppliers: [
      { name: "Dental Directory", price: 11.40, stock: true,  delivery: "2–3 days",  sku: "DD-OPT33-160", packSize: "160 wipes" },
      { name: "Dental Sky",       price: 11.90, stock: true,  delivery: "Next day",  sku: "DS-OPT33",     packSize: "160 wipes" },
      { name: "Clark Dental",     price: 12.40, stock: true,  delivery: "Next day",  sku: "CD-OPT33",     packSize: "160 wipes" },
      { name: "Henry Schein",     price: 13.20, stock: true,  delivery: "Next day",  sku: "HS-OPT33-160", packSize: "160 wipes" },
      { name: "Total Dental",     price: 13.80, stock: false, delivery: "4–5 days",  sku: "TD-OPT33",     packSize: "160 wipes" },
    ],
    similars: [22, 23],
  },
  {
    id: 22, name: "Cavicide Surface Disinfectant Spray — 946ml", brand: "Metrex", category: "Infection Control",
    image: IMG.cavicide,
    packSize: "946ml bottle",
    description: "CaviCide is a convenient, ready-to-use intermediate-level surface disinfectant. 3-minute tuberculocidal contact time. Effective against MRSA, VRE, HIV, HBV, HCV. No rinsing required.",
    specs: [
      { label: "Volume", value: "946ml" },
      { label: "Contact Time", value: "3 minutes" },
      { label: "Active Ingredient", value: "Isopropanol + Diisobutyl phenoxyethoxyethyl dimethyl benzyl ammonium chloride" },
      { label: "Rinse Required", value: "No" },
      { label: "Fragrance", value: "Fragrance-free" },
    ],
    suppliers: [
      { name: "Amalgadent",       price: 9.80,  stock: true,  delivery: "Next day",  sku: "AM-CAVI946",  packSize: "946ml" },
      { name: "DMI",              price: 10.20, stock: true,  delivery: "2–3 days",  sku: "DMI-CAVI946", packSize: "946ml" },
      { name: "Kent Express",     price: 10.80, stock: true,  delivery: "2–3 days",  sku: "KE-CAVI946",  packSize: "946ml" },
      { name: "Patterson Dental", price: 11.40, stock: true,  delivery: "3–4 days",  sku: "PAT-CAVI946", packSize: "946ml" },
    ],
    similars: [21, 23],
  },
  {
    id: 23, name: "Stericlin Self-Seal Sterilisation Pouches — 90×135mm (Pack of 200)", brand: "Stericlin", category: "Infection Control",
    image: IMG.pouches,
    packSize: "Pack of 200",
    description: "Stericlin self-sealing sterilisation pouches feature a clear front for instrument visibility and chemical indicators on the back. Compatible with steam, EO, and formaldehyde sterilisation processes. CE certified.",
    specs: [
      { label: "Size", value: "90 × 135mm" },
      { label: "Quantity", value: "200 per pack" },
      { label: "Compatible", value: "Steam, EO, formaldehyde" },
      { label: "Indicator", value: "Chemical indicator included" },
      { label: "Seal Type", value: "Self-sealing" },
      { label: "Certification", value: "CE, EN868-5" },
    ],
    suppliers: [
      { name: "Nuvelo",           price: 6.90,  stock: true,  delivery: "2–3 days",  sku: "NV-SS90200",   packSize: "200 pouches" },
      { name: "Dental Sky",       price: 7.20,  stock: true,  delivery: "Next day",  sku: "DS-SS90200",   packSize: "200 pouches" },
      { name: "J&S Davis",        price: 7.50,  stock: true,  delivery: "2–3 days",  sku: "JSD-SS90",     packSize: "200 pouches" },
      { name: "Henry Schein",     price: 8.10,  stock: true,  delivery: "Next day",  sku: "HS-STER90200", packSize: "200 pouches" },
    ],
    similars: [21, 22],
  },

  // ── IMPLANTS ─────────────────────────────────────────────────────────────
  {
    id: 24, name: "Straumann BLX Implant — 3.75mm × 10mm (RC)", brand: "Straumann", category: "Implants",
    image: IMG.blx,
    packSize: "Single implant",
    description: "Straumann BLX combines exceptional primary stability with broad indications. The self-cutting thread design and tapered body enable reliable immediate loading protocols. SLActive surface promotes rapid osseointegration within 3-4 weeks.",
    specs: [
      { label: "Diameter", value: "3.75mm" },
      { label: "Length", value: "10mm" },
      { label: "Connection", value: "RC (Regular CrossFit)" },
      { label: "Surface", value: "SLActive" },
      { label: "Material", value: "Grade IV titanium" },
      { label: "Protocol", value: "Immediate / early loading" },
    ],
    suppliers: [
      { name: "Henry Schein",     price: 148.00, stock: true,  delivery: "Next day",  sku: "HS-BLXRC3710", packSize: "Single" },
      { name: "Patterson Dental", price: 152.00, stock: true,  delivery: "3–4 days",  sku: "PAT-BLX3710",  packSize: "Single" },
      { name: "Clark Dental",     price: 154.50, stock: false, delivery: "5–7 days",  sku: "CD-BLX3710",   packSize: "Single" },
    ],
    similars: [25, 26],
  },
  {
    id: 25, name: "Nobel Active Implant — 3.5mm × 11.5mm", brand: "Nobel Biocare", category: "Implants",
    image: IMG.nobelactive,
    packSize: "Single implant",
    description: "Nobel Active features a unique conical implant body with an aggressive thread design for exceptional primary stability in all bone types. TiUnite surface ensures rapid and predictable osseointegration.",
    specs: [
      { label: "Diameter", value: "3.5mm" },
      { label: "Length", value: "11.5mm" },
      { label: "Connection", value: "Internal tri-channel" },
      { label: "Surface", value: "TiUnite (oxidised)" },
      { label: "Material", value: "Grade IV titanium" },
      { label: "Protocol", value: "Immediate / delayed" },
    ],
    suppliers: [
      { name: "Trycare",      price: 162.00, stock: true,  delivery: "Next day",  sku: "TC-NACC3511", packSize: "Single" },
      { name: "Henry Schein", price: 168.00, stock: true,  delivery: "Next day",  sku: "HS-NA3511",   packSize: "Single" },
      { name: "J&S Davis",    price: 171.50, stock: false, delivery: "7+ days",   sku: "JSD-NA3511",  packSize: "Single" },
    ],
    similars: [24, 26],
  },
  {
    id: 26, name: "BioHorizons Tapered Internal Implant — 4.0mm × 12mm", brand: "BioHorizons", category: "Implants",
    image: IMG.biohorizons,
    packSize: "Single implant",
    description: "BioHorizons Tapered Internal implants feature laser-lok micro-channels that promote bone and soft tissue attachment at the implant collar. Proven long-term stability with low marginal bone loss.",
    specs: [
      { label: "Diameter", value: "4.0mm" },
      { label: "Length", value: "12mm" },
      { label: "Connection", value: "Internal Morse taper" },
      { label: "Surface", value: "Laser-Lok + RBT" },
      { label: "Material", value: "Grade IV titanium" },
    ],
    suppliers: [
      { name: "Dental Directory", price: 98.00,  stock: true,  delivery: "2–3 days",  sku: "DD-BH4012",  packSize: "Single" },
      { name: "Medentra",         price: 102.00, stock: true,  delivery: "Next day",  sku: "MED-BH4012", packSize: "Single" },
      { name: "Henry Schein",     price: 109.00, stock: true,  delivery: "Next day",  sku: "HS-BH4012",  packSize: "Single" },
    ],
    similars: [24, 25],
  },

  // ── DIAGNOSTICS ──────────────────────────────────────────────────────────
  {
    id: 27, name: "VistaScan Mini View Phosphor Plate — Size 2 (5 plates)", brand: "Dürr Dental", category: "Diagnostics",
    image: IMG.vistascan,
    packSize: "5 plates",
    description: "VistaScan phosphor plates deliver outstanding image quality with the Dürr VistaScan scanner system. Flexible, thin plates for patient comfort. Reusable up to 10,000 times with proper care.",
    specs: [
      { label: "Size", value: "Size 2 (standard)" },
      { label: "Quantity", value: "5 plates" },
      { label: "Reusable", value: "Up to 10,000 cycles" },
      { label: "Compatible Scanner", value: "Dürr VistaScan" },
      { label: "Thickness", value: "0.6mm" },
    ],
    suppliers: [
      { name: "Clark Dental",     price: 42.80, stock: true,  delivery: "Next day",  sku: "CD-VSM-S2",  packSize: "5 plates" },
      { name: "Henry Schein",     price: 44.50, stock: true,  delivery: "Next day",  sku: "HS-VSMS2",   packSize: "5 plates" },
      { name: "Patterson Dental", price: 46.00, stock: true,  delivery: "3–4 days",  sku: "PAT-VSM2",   packSize: "5 plates" },
    ],
    similars: [28],
  },
  {
    id: 28, name: "Carestream Intraoral Sensor — Size 2 (Compatible)", brand: "Carestream", category: "Diagnostics",
    image: IMG.rvg,
    packSize: "Single sensor",
    description: "Carestream RVG 6100 compatible digital intraoral sensor provides exceptional image clarity with low radiation dose. USB connectivity, instant image acquisition, compatible with major dental imaging software.",
    specs: [
      { label: "Size", value: "Size 2" },
      { label: "Pixel Size", value: "19.5 μm" },
      { label: "Resolution", value: "20 lp/mm" },
      { label: "Interface", value: "USB 2.0" },
      { label: "Image Format", value: "TWAIN compatible" },
    ],
    suppliers: [
      { name: "DMI",          price: 820.00, stock: true,  delivery: "3–5 days",  sku: "DMI-CS-S2",  packSize: "Single" },
      { name: "Henry Schein", price: 860.00, stock: true,  delivery: "Next day",  sku: "HS-CSS2",    packSize: "Single" },
      { name: "Nuvelo",       price: 895.00, stock: false, delivery: "7+ days",   sku: "NV-CS-S2",   packSize: "Single" },
    ],
    similars: [27],
  },

  // ── ORTHODONTICS ─────────────────────────────────────────────────────────
  {
    id: 29, name: "3M Unitek Transbond XT Light Cure Adhesive — 5ml Syringe", brand: "3M Unitek", category: "Orthodontics",
    image: IMG.transbond,
    packSize: "5ml syringe",
    description: "Transbond XT is the world's most-used orthodontic bonding adhesive. Fluoride-releasing resin provides superior bond strength to enamel. Stays workable until cured, then sets instantly under LED or halogen light.",
    specs: [
      { label: "Volume", value: "5ml syringe" },
      { label: "Cure", value: "Light cure (LED/halogen)" },
      { label: "Fluoride Release", value: "Yes" },
      { label: "Shear Bond Strength", value: ">10 MPa" },
      { label: "Shade", value: "Opaque white" },
    ],
    suppliers: [
      { name: "Trycare",      price: 28.40, stock: true,  delivery: "Next day",  sku: "TC-TBXT5",    packSize: "5ml syringe" },
      { name: "Wrights",      price: 29.10, stock: true,  delivery: "Next day",  sku: "WR-TBXT5",    packSize: "5ml syringe" },
      { name: "Henry Schein", price: 30.80, stock: true,  delivery: "Next day",  sku: "HS-TBXT5",    packSize: "5ml syringe" },
      { name: "Total Dental", price: 31.50, stock: true,  delivery: "2–3 days",  sku: "TD-TBXT5",    packSize: "5ml syringe" },
    ],
    similars: [30],
  },
  {
    id: 30, name: "Dentsply GAC Orthos Ceramic Brackets — MBT 0.022 (Pack of 10)", brand: "Dentsply GAC", category: "Orthodontics",
    image: IMG.brackets,
    packSize: "Pack of 10 brackets",
    description: "GAC Orthos ceramic brackets provide exceptional aesthetics with a translucent appearance that blends with natural tooth colour. Rhomboid base mesh ensures reliable bond strength. MBT 0.022 prescription for controlled torque.",
    specs: [
      { label: "Prescription", value: "MBT" },
      { label: "Slot Size", value: "0.022 inch" },
      { label: "Quantity", value: "10 brackets" },
      { label: "Material", value: "Monocrystalline ceramic" },
      { label: "Tie Wing", value: "Conventional" },
    ],
    suppliers: [
      { name: "Amalgadent",   price: 54.00, stock: true,  delivery: "Next day",  sku: "AM-ORTHCER10", packSize: "Pack of 10" },
      { name: "Kent Express", price: 56.80, stock: true,  delivery: "2–3 days",  sku: "KE-ORTHCER",   packSize: "Pack of 10" },
      { name: "Henry Schein", price: 59.40, stock: false, delivery: "5–7 days",  sku: "HS-GACCER10",  packSize: "Pack of 10" },
    ],
    similars: [29],
  },
];

export function getBest(suppliers: Supplier[]) {
  const ins = suppliers.filter(s => s.stock);
  if (!ins.length) return null;
  return ins.reduce((a, b) => a.price < b.price ? a : b);
}
export function getMax(suppliers: Supplier[]) {
  const ins = suppliers.filter(s => s.stock);
  if (!ins.length) return 0;
  return Math.max(...ins.map(s => s.price));
}
export function getSaving(suppliers: Supplier[]) {
  const best = getBest(suppliers);
  if (!best) return 0;
  return getMax(suppliers) - best.price;
}

export const CATEGORY_META: Record<string, { icon: string; color: string; bg: string }> = {
  PPE:                { icon: "safety_check",  color: "#0ea5e9", bg: "#f0f9ff" },
  Consumables:        { icon: "science",        color: "#8b5cf6", bg: "#f5f3ff" },
  Anaesthetics:       { icon: "colorize",       color: "#f59e0b", bg: "#fffbeb" },
  Instruments:        { icon: "build",          color: "#10b981", bg: "#f0fdf4" },
  "Infection Control":{ icon: "clean_hands",   color: "#06b6d4", bg: "#ecfeff" },
  Implants:           { icon: "verified",       color: "#6366f1", bg: "#eef2ff" },
  Diagnostics:        { icon: "monitor_heart",  color: "#ef4444", bg: "#fef2f2" },
  Endodontics:        { icon: "healing",        color: "#f97316", bg: "#fff7ed" },
  Orthodontics:       { icon: "straighten",     color: "#a855f7", bg: "#faf5ff" },
};

export const ALL_CATEGORIES = ["All", "PPE", "Consumables", "Anaesthetics", "Instruments", "Infection Control", "Implants", "Diagnostics", "Endodontics", "Orthodontics"];
export const ALL_SUPPLIERS = [
  "Henry Schein", "Kent Express", "Dental Sky", "DHB", "Trycare",
  "DMI", "Wrights", "Clark Dental", "J&S Davis", "Patterson Dental",
  "Medentra", "Total Dental", "Amalgadent", "Nuvelo", "Dental Directory",
];
