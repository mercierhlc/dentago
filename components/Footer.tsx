import Link from "next/link";
import { DentagoLogo } from "@/components/DentagoLogo";
import { MARKETPLACE_HREF_FROM_MARKETING } from "@/lib/site-layout";

export default function Footer() {
  return (
    <footer className="foot dentago-marketing-root">
      <div className="foot-inner">
        <div className="brand">
          <Link href="/" className="logo flex items-center gap-2.5">
            <DentagoLogo size={22} variant="inverse" />
            <span>Dentago</span>
          </Link>
          <p>One tab. Every UK supplier. Your real prices, your real workflow.</p>
        </div>
        <div>
          <h6>Product</h6>
          <Link href={MARKETPLACE_HREF_FROM_MARKETING}>Marketplace</Link>
          <Link href="/platform">Pro features</Link>
          <Link href="/pricing">Pricing</Link>
          <Link href="/resources">Integrations</Link>
        </div>
        <div>
          <h6>Solutions</h6>
          <Link href="/solutions/single-site-practices">Single-site</Link>
          <Link href="/solutions/multi-site-groups">Multi-site groups</Link>
          <Link href="/solutions/dsos-corporates">DSOs</Link>
          <Link href="/solutions/nhs-practices">NHS practices</Link>
        </div>
        <div>
          <h6>Resources</h6>
          <Link href="/blog">Blog</Link>
          <Link href="/resources">Help center</Link>
          <Link href="/customers">Customers</Link>
          <Link href="/resources">Newsletter</Link>
        </div>
        <div>
          <h6>Company</h6>
          <Link href="/customers">About</Link>
          <Link href="/resources">Careers</Link>
          <Link href="mailto:mercier@dentago.co.uk">Contact</Link>
          <Link href="/privacy">Security</Link>
        </div>
      </div>
      <div className="foot-inner foot-bottom">
        <div>© 2026 Dentago Ltd · London</div>
        <div>
          <Link href="/resources" style={{ display: "inline", padding: "0 4px 0 0" }}>
            Status
          </Link>
          <span style={{ opacity: 0.7 }}>· </span>
          <Link href="/privacy" style={{ display: "inline", padding: "0 4px" }}>
            Privacy
          </Link>
          <span style={{ opacity: 0.7 }}>· </span>
          <Link href="/terms" style={{ display: "inline", padding: "0 0 0 4px" }}>
            Terms
          </Link>
        </div>
      </div>
    </footer>
  );
}
