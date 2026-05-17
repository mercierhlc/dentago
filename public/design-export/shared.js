// Dentago — shared chrome (nav + footer) injected into every page
(function(){
  const PAGE = document.body.dataset.page || '';
  const navHTML = `
  <div class="announce">
    <span class="dot"></span>
    <span>10,000+ products. Every major UK supplier. One tab. — <a href="#">Get started free →</a></span>
  </div>
  <nav class="top">
    <div class="nav-inner">
      <a href="dentago-landing.html" class="logo">
        <span class="logo-mark"></span><span>Dentago</span>
      </a>
      <div class="nav-links">
        <button class="nav-link" data-menu="platform" aria-expanded="false">Platform <svg class="caret" viewBox="0 0 10 10" fill="none"><path d="M2 4l3 3 3-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
        <button class="nav-link" data-menu="solutions" aria-expanded="false">Solutions <svg class="caret" viewBox="0 0 10 10" fill="none"><path d="M2 4l3 3 3-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
        <a class="nav-link" href="marketplace.html">Marketplace</a>
        <button class="nav-link" data-menu="resources" aria-expanded="false">Resources <svg class="caret" viewBox="0 0 10 10" fill="none"><path d="M2 4l3 3 3-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
        <a class="nav-link" href="pricing.html">Pricing</a>
      </div>
      <div class="nav-cta">
        <a href="#" class="btn btn-light">Sign in</a>
        <a href="#" class="btn btn-dark">Get a demo <span class="arr">→</span></a>
      </div>
    </div>
  </nav>
  <div class="mega-backdrop"></div>

  <div class="mega" data-menu="platform">
    <div class="mega-grid">
      <div class="mega-col">
        <h4>Free · Procurement</h4>
        <a class="mega-feature" href="marketplace.html">
          <div class="ttl"><span class="ic">M</span>Marketplace</div>
          <div class="desc">Search every UK supplier in one place. See your real prices side-by-side.</div>
        </a>
        <a class="mega-feature" href="marketplace.html">
          <div class="ttl"><span class="ic t">C</span>Unified Cart</div>
          <div class="desc">One basket, every supplier. One checkout, every order.</div>
        </a>
        <a class="mega-feature" href="marketplace.html">
          <div class="ttl"><span class="ic p">F</span>Favourites &amp; Reorder</div>
          <div class="desc">Save what you order most. Reorder in one tap at your best price.</div>
        </a>
      </div>
      <div class="mega-col">
        <h4>Pro · Automation <span class="badge">£299/mo</span></h4>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 16px">
          <a class="mega-feature" href="pro-features.html"><div class="ttl"><span class="ic">H</span>Procurement Hub</div></a>
          <a class="mega-feature" href="pro-features.html"><div class="ttl"><span class="ic t">S</span>Stock Tracking</div></a>
          <a class="mega-feature" href="pro-features.html"><div class="ttl"><span class="ic">P</span>Predictive Par</div></a>
          <a class="mega-feature" href="pro-features.html"><div class="ttl"><span class="ic o">A</span>Auto-Reorder</div></a>
          <a class="mega-feature" href="pro-features.html"><div class="ttl"><span class="ic p">Q</span>Approval Queue</div></a>
          <a class="mega-feature" href="pro-features.html"><div class="ttl"><span class="ic t">$</span>Spend Analytics</div></a>
          <a class="mega-feature" href="pro-features.html"><div class="ttl"><span class="ic">B</span>Budget Ceiling</div></a>
          <a class="mega-feature" href="pro-features.html"><div class="ttl"><span class="ic o">I</span>Consolidated Invoice</div></a>
          <a class="mega-feature" href="pro-features.html"><div class="ttl"><span class="ic">S</span>Smart Order Gen</div></a>
          <a class="mega-feature" href="pro-features.html"><div class="ttl"><span class="ic p">A</span>AI Assistant</div></a>
        </div>
      </div>
      <div class="mega-col">
        <h4>Featured</h4>
        <a class="mega-feat" href="pro-features.html">
          <div class="lbl">Now in beta</div>
          <h5>Predictive par alerts: know 4 days before you run out.</h5>
          <span class="arrow">See how it works <span class="a">→</span></span>
        </a>
      </div>
    </div>
  </div>

  <div class="mega" data-menu="solutions">
    <div class="mega-grid two">
      <div class="mega-col">
        <h4>By clinic type</h4>
        <a class="mega-link" href="#">Single-site practices</a>
        <a class="mega-link" href="#">Multi-site groups</a>
        <a class="mega-link" href="#">DSOs &amp; corporates</a>
        <a class="mega-link" href="#">NHS practices</a>
        <a class="mega-link" href="#">Specialist clinics</a>
      </div>
      <div class="mega-col">
        <h4>For roles</h4>
        <a class="mega-link" href="#">Practice managers</a>
        <a class="mega-link" href="#">Principal dentists</a>
        <a class="mega-link" href="#">Group operations</a>
        <a class="mega-link" href="#">Finance teams</a>
      </div>
      <div class="mega-col">
        <h4>For workflows</h4>
        <a class="mega-link" href="#">Daily ordering</a>
        <a class="mega-link" href="#">Stockroom requests</a>
        <a class="mega-link" href="#">Monthly reconciliation</a>
        <a class="mega-link" href="#">Spend review</a>
      </div>
      <div class="mega-col">
        <h4>Featured</h4>
        <a class="mega-feat" href="#">
          <div class="lbl">Case study</div>
          <h5>How Smile Dental cut £4,212 from one quarter.</h5>
          <span class="arrow">Read the story <span class="a">→</span></span>
        </a>
      </div>
    </div>
  </div>

  <div class="mega" data-menu="resources">
    <div class="mega-grid two">
      <div class="mega-col">
        <h4>Explore</h4>
        <a class="mega-link" href="#">Blog</a>
        <a class="mega-link" href="#">Procurement playbook</a>
        <a class="mega-link" href="#">Spend benchmark report</a>
        <a class="mega-link" href="#">Newsletter</a>
      </div>
      <div class="mega-col">
        <h4>Get started</h4>
        <a class="mega-link" href="#">Talk to sales</a>
        <a class="mega-link" href="#">Help center</a>
        <a class="mega-link" href="#">Connect a supplier</a>
        <a class="mega-link" href="#">Onboarding guide</a>
      </div>
      <div class="mega-col">
        <h4>Customers</h4>
        <a class="mega-link" href="#">Case studies</a>
        <a class="mega-link" href="#">Testimonials</a>
        <a class="mega-link" href="#">Smile Dental</a>
        <a class="mega-link" href="#">Bright Group</a>
      </div>
      <div class="mega-col">
        <h4>Featured</h4>
        <a class="mega-feat" href="#">
          <div class="lbl">2025 report</div>
          <h5>The state of UK dental procurement.</h5>
          <span class="arrow">Download <span class="a">→</span></span>
        </a>
      </div>
    </div>
  </div>
  `;

  const footHTML = `
  <footer class="foot">
    <div class="foot-inner">
      <div class="brand">
        <a href="dentago-landing.html" class="logo"><span class="logo-mark"></span><span>Dentago</span></a>
        <p>One tab. Every UK supplier. Your real prices, your real workflow.</p>
      </div>
      <div>
        <h6>Product</h6>
        <a href="marketplace.html">Marketplace</a>
        <a href="pro-features.html">Pro features</a>
        <a href="pricing.html">Pricing</a>
        <a href="#">Integrations</a>
      </div>
      <div>
        <h6>Solutions</h6>
        <a href="#">Single-site</a>
        <a href="#">Multi-site groups</a>
        <a href="#">DSOs</a>
        <a href="#">NHS practices</a>
      </div>
      <div>
        <h6>Resources</h6>
        <a href="#">Blog</a>
        <a href="#">Help center</a>
        <a href="#">Customers</a>
        <a href="#">Newsletter</a>
      </div>
      <div>
        <h6>Company</h6>
        <a href="#">About</a>
        <a href="#">Careers</a>
        <a href="#">Contact</a>
        <a href="#">Security</a>
      </div>
    </div>
    <div class="foot-inner foot-bottom">
      <div>© 2026 Dentago Ltd · London</div>
      <div>Status · Privacy · Terms</div>
    </div>
  </footer>
  `;

  // Inject nav at #nav-mount, footer at #foot-mount
  const navMount = document.getElementById('nav-mount');
  const footMount = document.getElementById('foot-mount');
  if(navMount) navMount.innerHTML = navHTML;
  if(footMount) footMount.innerHTML = footHTML;

  // Highlight current page
  document.querySelectorAll('.nav-link').forEach(l => {
    if(l.getAttribute('href') && l.getAttribute('href').toLowerCase().includes(PAGE.toLowerCase()) && PAGE){
      l.style.background='#fff';
    }
  });

  // ---- Mega menu ----
  const links = document.querySelectorAll('.nav-link[data-menu]');
  const menus = document.querySelectorAll('.mega');
  const backdrop = document.querySelector('.mega-backdrop');
  let openId = null, closeTimer = null;
  function openMenu(id){
    if(closeTimer){clearTimeout(closeTimer);closeTimer=null}
    if(openId===id) return;
    openId = id;
    links.forEach(l => l.setAttribute('aria-expanded', l.dataset.menu===id ? 'true' : 'false'));
    menus.forEach(m => m.classList.toggle('open', m.dataset.menu===id));
    if(backdrop) backdrop.classList.add('open');
  }
  function closeAll(){
    openId=null;
    links.forEach(l => l.setAttribute('aria-expanded','false'));
    menus.forEach(m => m.classList.remove('open'));
    if(backdrop) backdrop.classList.remove('open');
  }
  function scheduleClose(){
    if(closeTimer) clearTimeout(closeTimer);
    closeTimer = setTimeout(closeAll, 180);
  }
  links.forEach(link => {
    link.addEventListener('mouseenter', () => openMenu(link.dataset.menu));
    link.addEventListener('mouseleave', scheduleClose);
    link.addEventListener('click', e => {
      e.preventDefault();
      if(openId===link.dataset.menu) closeAll(); else openMenu(link.dataset.menu);
    });
  });
  menus.forEach(m => {
    m.addEventListener('mouseenter', () => { if(closeTimer){clearTimeout(closeTimer);closeTimer=null} });
    m.addEventListener('mouseleave', scheduleClose);
  });
  if(backdrop) backdrop.addEventListener('click', closeAll);
  document.addEventListener('keydown', e => { if(e.key==='Escape') closeAll() });

  // ---- Scroll reveal ----
  const reveals = document.querySelectorAll('.reveal');
  if('IntersectionObserver' in window){
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, {rootMargin:'-40px', threshold:0.05});
    reveals.forEach(r => io.observe(r));
  } else {
    reveals.forEach(r => r.classList.add('in'));
  }
})();
