import { Resend } from "resend";

const resend = new Resend("re_HhUc2mth_DjMxE6qwzpht5vBy6Hs14irH");
const FROM = "mercier@dentago.co.uk";
const FROM_NAME = "Mercier @ Dentago";

// ── All 201 emails from Batches 1, 2, 3 ──────────────────────────────────────
// Reconstructed from Obsidian sent log

const BATCH1: { name: string; email: string }[] = [
  { name: "128 Harley Street Dental Suite", email: "info@128harleystreet.com" },
  { name: "19 Wimpole Street Dental Practice", email: "ramina@19wimpolestdental.com" },
  { name: "25 Devonshire Place", email: "25devonshireplace@gmail.com" },
  { name: "38 Devonshire Street Dental Practice", email: "info@38devonshirestreet.co.uk" },
  { name: "75 Harley Street Dental Practice", email: "info@75harleystreet.co.uk" },
  { name: "AF Dentist", email: "info@afdentist.com" },
  { name: "Abraham Specialist Dental Care", email: "robert.abraham@btconnect.com" },
  { name: "Ace Dental London", email: "london@acedental.co.uk" },
  { name: "Aesthetic Dentistry Barnet", email: "info@aestheticdentists.co.uk" },
  { name: "American Smile Dentists Chelsea", email: "americansmile@happykidsdental.co.uk" },
  { name: "Andersson Clinic", email: "drf@anderssonclinic.com" },
  { name: "Bandlish & Auplish Dentistry", email: "info@bandlishauplish.co.uk" },
  { name: "Bayswater Dental Clinic", email: "info@bayswaterdental.co.uk" },
  { name: "Be Dental Clinic Harley Street", email: "info@bedental.co.uk" },
  { name: "Bespoke Smile London", email: "smile@bespokesmile.co.uk" },
  { name: "Blanche Smile Studio", email: "info@blanchesmilestudio.co.uk" },
  { name: "Bond Dental London", email: "info@bonddental.co.uk" },
  { name: "DENSTUDIO", email: "hello@denstudio.co.uk" },
  { name: "DENTEXCEL", email: "mail@dentexcel.co.uk" },
  { name: "Dawood and Tanner", email: "office@dawoodandtanner.co.uk" },
  { name: "Banning Dental Group", email: "info@banningdental.co.uk" },
  { name: "Doctor Taneh", email: "info@doctortaneh.com" },
  { name: "Dr Charles Ferber", email: "info@guyandfaverodental.co.uk" },
  { name: "Dr Jerome Sebah", email: "info@thedentistgallery.com" },
  { name: "Dr Omid Sobhani", email: "reception@omidsobhani.com" },
  { name: "Dr Patrick Tarrant", email: "info@tarrantlondondental.co.uk" },
  { name: "Dr Pippa Saul-Harrah", email: "info@drpsharrah.com" },
  { name: "Dr Saul Konviser", email: "saul@drsaul.co.uk" },
  { name: "Dr. Monica's Dental Clinic", email: "monicadental10@yahoo.co.uk" },
  { name: "Dr. Nick Jahany", email: "info@drnickjahany.com" },
  { name: "Elgin Dental Care", email: "info@elgindentalcare.co.uk" },
  { name: "Elleven Dental", email: "info@ellevendental.com" },
  { name: "EndoCare Harley Street", email: "reception@endocare.co.uk" },
  { name: "French Dental Practice", email: "frenchdentalpractice@gmail.com" },
  { name: "French Dentist London", email: "drbrunodelaunay@gmail.com" },
  { name: "Freshdental Clinic", email: "reception@freshdental.co.uk" },
  { name: "Garden Square Dental Practice", email: "info@gardensquaredental.co.uk" },
  { name: "Happy Kids Dental Marylebone", email: "info@happykidsdental.co.uk" },
  { name: "Harley Street Dental & Implant Clinic", email: "reception.alexandra@portmandental.co.uk" },
  { name: "Harley Street Dental Studio", email: "sangita@harleystreetdentalgroup.org" },
  { name: "Harry Shiers Dentistry", email: "harryshiersdentistry@gmail.com" },
  { name: "Heffernan Dental Specialists", email: "info@hdsdentists.com" },
  { name: "Holford Partners Curaden", email: "smile@holfordcuraden.com" },
  { name: "Hyde Park Dental Clinic", email: "info@hydeparkdentalclinic.co.uk" },
  { name: "Implant & Perio Clinic", email: "info@implantperio.net" },
  { name: "Ivory Dental Studio", email: "contact@theivorydentalstudio.co.uk" },
  { name: "Kensington Dentist", email: "by.blossom@yahoo.com" },
  { name: "Knightsbridge Dentist", email: "info@knightsbridge-dentist.co.uk" },
  { name: "London Holistic Dental Centre", email: "info@londonholisticdental.com" },
  { name: "London Periodontics", email: "info@lpid.co.uk" },
  { name: "London Teeth Whitening", email: "info@london-teeth-whitening.co.uk" },
  { name: "Maida Smiles Dental Clinic", email: "info@maidasmiles.co.uk" },
  { name: "Marble Arch Dental Centre", email: "info@marblearchmed.co.uk" },
  { name: "Mark Barrett Dentistry", email: "reception@markbarrettdentistry.co.uk" },
  { name: "Marylebone House Dental Practice", email: "marylebone@rodericksdental.co.uk" },
  { name: "Marylebone Implant Centre", email: "info@maryleboneimplantcentre.co.uk" },
  { name: "Montagu Dental", email: "contact@montagudental.com" },
  { name: "Motcomb Street Dentist", email: "info@motcombstreetdentist.co.uk" },
  { name: "NHS Dentist Earl's Court", email: "info@earlscourtdental.com" },
  { name: "Norton Implants", email: "manager@nortonimplants.com" },
  { name: "Only One Clinic", email: "kishan@onlyoneclinic.co.uk" },
];

const BATCH2: { name: string; email: string }[] = [
  { name: "Dr D W Owen - Kirkcudbright Dental Surgery", email: "admin@kbtdental.co.uk" },
  { name: "The Dental Clinic Ayr", email: "info@thedentalclinicayr.com" },
  { name: "Church View Dental Clinic", email: "care@church-view-dental.com" },
  { name: "Smile Dental Centre", email: "whitmorewaydentalcentre@gmail.com" },
  { name: "The Town House Dental Practice", email: "brighton@townhousedentalpractice.co.uk" },
  { name: "Plean Street Dental", email: "pleanstreetdental@gmail.com" },
  { name: "King Street Dental Practice", email: "info@kingstreetdentalpractice.com" },
  { name: "Dentistry on the Clyde", email: "ianmcgrath156@btinternet.com" },
  { name: "Links Road Dental Practice", email: "linksroaddental@clydemunrodental.com" },
  { name: "Leamington Spa Dental Practice", email: "info@lsdp.co.uk" },
  { name: "Whickham Dental Practice", email: "info@whickhamdentalpractice.co.uk" },
  { name: "Barns Dental Practice", email: "reception@barnsdentalpractice.co.uk" },
  { name: "Thornhill Dental Practice", email: "info@thornhilldentalpractice.co.uk" },
  { name: "Kingswalk Dental Implant Practice", email: "reception@kingswalkdental.co.uk" },
  { name: "Pearl Dental Practice", email: "info@pearldentalpractice.co.uk" },
  { name: "Girvan Dental Practice", email: "reception@girvandental.co.uk" },
  { name: "Lewis Dentistry", email: "lewisdentistry@outlook.com" },
  { name: "Stranraer Dental Laboratory", email: "stranraerdentallab@gmail.com" },
  { name: "Gentle Dental Care of Worcester", email: "worcester@rodericksdental.co.uk" },
  { name: "Epworth House Dental Practice", email: "info@epworthhouse.co.uk" },
  { name: "Amblecote Dental Care", email: "amblecote@dentalpartners.co.uk" },
  { name: "Maybole Dental Practice", email: "mayboledental@clydemunrodental.com" },
  { name: "Railway Dental", email: "info@railwaydental.co.uk" },
  { name: "Richard Gatenby Implant Dentistry", email: "info@implant-dentistry.me.uk" },
  { name: "The Dental Surgery Wolverhampton", email: "reception.wolverhampton@colosseumdental.co.uk" },
  { name: "Redcliffe Orthodontics", email: "enquiries@redcliffeorthodontics.co.uk" },
  { name: "Wightwick Dental Practice", email: "office@wightwickdentalpractice.co.uk" },
  { name: "Dentale", email: "info@dentale.co.uk" },
  { name: "Worcestershire Community Dental Services", email: "whcnhs.paediatricot@nhs.net" },
  { name: "Clent Dentist", email: "info@clentdentist.com" },
  { name: "Karen Sutton Dentist", email: "info@beacondentalcare.co.uk" },
  { name: "St Johns Hill Dental", email: "info@stjohnsdp.co.uk" },
  { name: "Ambleside Dental Practice", email: "info@amblesidedental.co.uk" },
  { name: "Dr S Bromley - Bridge Dental Centre", email: "hello@bridgedentalclinic.com" },
  { name: "Clear Smiles Wolverhampton", email: "info@clearsmiles.dentist" },
  { name: "The Smile Centre Shrewsbury", email: "patient@thesmilecentreshrewsbury.co.uk" },
  { name: "Alliance Dentistry", email: "info@alliancedentistry.co.uk" },
  { name: "Wolverhampton Dental", email: "info@wolverhamptondentist.co.uk" },
  { name: "Halfway House Dental", email: "info@halfwayhousedental.co.uk" },
  { name: "Ombersley Family Dental Practice", email: "info@ombersleyfamilydental.co.uk" },
  { name: "Wolverhampton Special Care Dental", email: "rwh-tr.communicationsdept@nhs.net" },
  { name: "Richmond House Dental Practice", email: "enquiries@richmondhousedental.co.uk" },
  { name: "The247dentist Worcester", email: "videodentist@the247dentist.com" },
  { name: "Weobley Dental Surgery", email: "reception@weobleydentalsurgery.co.uk" },
  { name: "Abbotsbury Court Dental Practice", email: "abbotsburydental@gmail.com" },
  { name: "Kinver Village Dental Practice", email: "enquiries@kinvervillagedental.com" },
  { name: "Larcholme Dental Practice", email: "info@larcholme.co.uk" },
  { name: "Imperial Dental Group Worcester", email: "worcester@imperialdentalpractice.co.uk" },
  { name: "MJ Warren Dental Practice", email: "reception@mjwarrendentalpractice.co.uk" },
  { name: "Wall Heath Dental Practice", email: "info@wallheathdental.co.uk" },
  { name: "Parkdale Dental and Implant Clinic", email: "info@parkdaledentalandimplantclinic.co.uk" },
  { name: "Reindeer Court Dental Practice", email: "reindeer.dental@gmail.com" },
  { name: "Willows Dental & Implant Centre", email: "info@willowsdental.co.uk" },
  { name: "Aesthetics Dental and Implant Surgery", email: "pickeringhouse.dentalpractice@nhs.net" },
  { name: "Implants Dorset", email: "info@implantsdorset.com" },
  { name: "Antrim House Dental Practice", email: "antrimhousedental23@gmail.com" },
  { name: "Denora Worcester Dental Clinic", email: "worcester@denora.co.uk" },
  { name: "Church Stretton Dental & Implant Centre", email: "info@csd-ic.co.uk" },
  { name: "The Priors Dental Practice", email: "info@thepriorsdentalpractice.co.uk" },
  { name: "Shrawley House Dental Practice", email: "hello@shrawleyhousedental.co.uk" },
  { name: "Claregate Dental Practice", email: "info@claregatedental.co.uk" },
  { name: "Pride Hill Dental", email: "reception@pridehilldentalsurgery.co.uk" },
  { name: "IW Dental Laboratory", email: "iw@als-dental.com" },
  { name: "Kington Dental Practice", email: "reception@kingtondental.co.uk" },
  { name: "Pontesbury Dental Practice", email: "info@pontesburydental.co.uk" },
  { name: "Aspire Dental & Facial Aesthetics", email: "info@aspire-dental.co.uk" },
  { name: "Stourcote Dental & Implant Practice", email: "reception@stourcotedentalpractice.co.uk" },
  { name: "South Road Dental Practice", email: "info@southroaddentalpractice.co.uk" },
  { name: "Woodhouse Dental Practice", email: "woodhousedentalpractice@gmail.com" },
  { name: "Dovedale Dental Practice", email: "contact@dovedaledentalpractice.co.uk" },
  { name: "Bradley Shorthouse Dental Clinic", email: "reception@bradleyshorthouse.co.uk" },
  { name: "Kinver Dental & Implant Surgery", email: "kinverpm@outlook.com" },
  { name: "Gestridge Dental Studio", email: "gestridgedentalsurgery@hotmail.co.uk" },
  { name: "Serene Dental Ltd", email: "info@serenedentalpractice.co.uk" },
  { name: "Hagley Dental Practice", email: "hello@hagleydentalpractice.co.uk" },
  { name: "Redhill Dental Clinic", email: "info@redhilldental.co.uk" },
  { name: "Bhandal Dental Practice - Lye", email: "info@bhandaldentalpractices.co.uk" },
  { name: "Bovey Dental Practice", email: "boveydental@gmail.com" },
  { name: "Smile Works Malinslee", email: "info@thesmileworks.com" },
  { name: "Droitwich Dental Studio", email: "info@droitwichdentalstudio.co.uk" },
  { name: "Hygeia Dental Care", email: "info@hygeia.co.uk" },
  { name: "WV1 Dental & Implant Clinic", email: "reception@wv1dental.co.uk" },
  { name: "Goldthorn Dental Practice", email: "gtreception@sagroups.co.uk" },
  { name: "Codsall Dental Practice", email: "reception@codsalldentalpractice.co.uk" },
  { name: "Greenhill Dental Practice", email: "greenhilldp@outlook.com" },
  { name: "Stirchley Dental Practice Telford", email: "reception@plumsteaddentalsurgery.co.uk" },
  { name: "St Giles Dental", email: "info@stgiles.wales" },
  { name: "Richmond Dental Practice", email: "info@richmond-dental.com" },
  { name: "Millbrook Villas Dental Practice", email: "millbrookdental@gmail.com" },
  { name: "Worcester Street Dental Practice", email: "reception@worcesterstreetdentalpractice.co.uk" },
  { name: "Littlemoor Dental Surgery", email: "littlemoordental@mail.com" },
  { name: "Tenbury Dental Centre", email: "hello@tenburydental.com" },
  { name: "Malvern Spring Dental Practice", email: "malvernspringdental@soegateway.com" },
  { name: "Moss Grove Dental Practice", email: "info@mossgrovedental.co.uk" },
  { name: "Highview Dental Practice", email: "contact@highviewdentalpractice.co.uk" },
  { name: "Dolphins Dental", email: "thepractice@dolphinsdental.com" },
  { name: "Comberton Dental Surgery", email: "comberton.surgery@nhs.net" },
  { name: "Droitwich Spa Dental Aesthetics", email: "droitwichdental@gmail.com" },
  { name: "Shrubbery Dental Practice", email: "reception@shrubberydental.co.uk" },
  { name: "Tudor Dental Clinic", email: "tudorclinic@gmail.com" },
  { name: "Cherrybrook Dental Surgery", email: "info@cherrybrookdental.co.uk" },
  { name: "Stella Dental Stourbridge", email: "clients@stelladentalsuite.co.uk" },
  { name: "Smiles Ahead", email: "smilesahead@btconnect.com" },
  { name: "Sedgley Dental Care", email: "info@sedgleydentalcare.co.uk" },
  { name: "Wolverhampton Dental Clinic", email: "recruitment@colosseumdental.co.uk" },
  { name: "Station House Dental Practice", email: "patient@stationhousedentalpractice.co.uk" },
  { name: "High Town Dental Practice", email: "reception@htdp.co.uk" },
  { name: "Venus Dental Totnes", email: "venusdentaltotnes@gmail.com" },
  { name: "St Paul's Dental Practice", email: "info@stpaulsdentalpractice.co.uk" },
  { name: "Ocean Orthodontic Clinic", email: "info@oceanorthodontics.co.uk" },
  { name: "Gentle Dental Care of Droitwich", email: "reception@gentledentaldroitwich.co.uk" },
  { name: "Pure Dental Care", email: "pdcare42@gmail.com" },
  { name: "Brij Dhody Dental Practice", email: "info@brijdhodydentalpractice.co.uk" },
  { name: "Park Street Dental Practice", email: "contact@weymouthendodontics.co.uk" },
  { name: "Stanley Dental Practice", email: "reception@stanleypractice.co.uk" },
  { name: "Dolgellau Eirlys Dental Practice", email: "colwynbay@eirlysdental.co.uk" },
  { name: "Bewdley Dental Practice", email: "info@bewdleydentalpractice.co.uk" },
  { name: "Llanidloes Dental Practice", email: "llanidloesdental@yahoo.co.uk" },
  { name: "Cleobury Dental Practice", email: "hello@cleoburydental.co.uk" },
  { name: "Malvern Hills Dental Care", email: "reception@malvernhillsdentalcare.org" },
  { name: "Foley Park Dental & Implant Centre", email: "reception@foleyparkdental.co.uk" },
  { name: "Spa Dental Clinic", email: "info@spadentalclinic.co.uk" },
  { name: "Treetops Dental Surgery", email: "reception@treetopsdentalsurgery.co.uk" },
  { name: "St Johns Dental", email: "stjohnsdental11@gmail.com" },
  { name: "May House Dental Practice", email: "info@mayhousedental.co.uk" },
  { name: "Shawbirch Dental Practice", email: "info@shawbirchdental.co.uk" },
];

const BATCH3: { name: string; email: string }[] = [
  { name: "Birch Valley Dental Clinic", email: "info@birch-valley.co.uk" },
  { name: "Wollaston Dental Practice", email: "info@wollastondental.co.uk" },
  { name: "New Park House Dental Centre", email: "reception@nphd.co.uk" },
  { name: "Dental Health Stop", email: "info@dentalhealthstop.co.uk" },
  { name: "DK Dental Practice", email: "info@dkdentalpracticeandlab.com" },
  { name: "Roy Morris Dental & Implant Excellence", email: "smiles@excellence-in-dentistry.co.uk" },
];

// ── Email 2 — Follow-up template ──────────────────────────────────────────────
function buildFollowUp(practiceName: string): { subject: string; html: string } {
  return {
    subject: `Re: Quick question for ${practiceName}`,
    html: `
<p>Hi there,</p>

<p>Just following up on my email from a few days ago in case it got buried.</p>

<p>I'm building Dentago — a free tool that lets UK dental practices compare prices across Henry Schein, Kent Express, Dental Sky and 40+ other suppliers in one place. Takes about 15 minutes to set up and most practices find they're overpaying somewhere.</p>

<p>Worth a quick look? Happy to walk you through it on a short call — no commitment, just showing you the tool.</p>

<p>Best,<br/>
Mercier<br/>
Dentago — <a href="https://www.dentago.co.uk">www.dentago.co.uk</a></p>
`.trim(),
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const all = [
    ...BATCH1.map(p => ({ ...p, batch: 1 })),
    ...BATCH2.map(p => ({ ...p, batch: 2 })),
    ...BATCH3.map(p => ({ ...p, batch: 3 })),
  ];

  // Deduplicate by email
  const seen = new Set<string>();
  const targets = all.filter(p => {
    if (seen.has(p.email.toLowerCase())) return false;
    seen.add(p.email.toLowerCase());
    return true;
  });

  console.log(`📤 Sending Email 2 follow-up to ${targets.length} practices from Batches 1–3\n`);

  const results: { name: string; email: string; batch: number; status: string }[] = [];

  for (const p of targets) {
    const { subject, html } = buildFollowUp(p.name);
    try {
      await resend.emails.send({
        from: `${FROM_NAME} <${FROM}>`,
        to: p.email,
        subject,
        html,
        replyTo: FROM,
      });
      results.push({ ...p, status: "Sent" });
      console.log(`✅ [B${p.batch}] ${p.name} → ${p.email}`);
    } catch (err: any) {
      results.push({ ...p, status: "Failed" });
      console.error(`❌ [B${p.batch}] ${p.name}: ${err?.message ?? err}`);
    }
    await new Promise(r => setTimeout(r, 200));
  }

  const sent = results.filter(r => r.status === "Sent").length;
  const failed = results.filter(r => r.status === "Failed").length;
  console.log(`\n📊 Follow-up complete: ${sent} sent, ${failed} failed`);
  console.log("\n=== SENT ===");
  results.filter(r => r.status === "Sent").forEach((r, i) =>
    console.log(`${i + 1}. [B${r.batch}] ${r.name} | ${r.email}`)
  );
  if (failed > 0) {
    console.log("\n=== FAILED ===");
    results.filter(r => r.status === "Failed").forEach((r, i) =>
      console.log(`${i + 1}. ${r.name} | ${r.email}`)
    );
  }
}

main().catch(console.error);
