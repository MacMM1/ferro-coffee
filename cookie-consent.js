(() => {
  // TODO: replace with this client's real GA4 Measurement ID once you've created a GA4 property for their site
  // (Google Analytics > Admin > Data Streams > their web stream > Measurement ID, looks like G-ABC1234XYZ)
  // See website-services/analytics_setup.md for the full walkthrough.
  const GA_MEASUREMENT_ID = 'G-XXXXXXXXXX';
  const CONSENT_KEY = 'rd-consent';

  const getConsent = () => {
    try { return localStorage.getItem(CONSENT_KEY); } catch (e) { return null; }
  };
  const setConsent = (value) => {
    try { localStorage.setItem(CONSENT_KEY, value); } catch (e) {}
  };

  const loadGA4 = () => {
    if (window.__rdGaLoaded || GA_MEASUREMENT_ID.includes('XXXXXXXXXX')) return;
    window.__rdGaLoaded = true;
    const s = document.createElement('script');
    s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
    s.async = true;
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    function gtag(){ window.dataLayer.push(arguments); }
    window.gtag = gtag;
    gtag('js', new Date());
    gtag('config', GA_MEASUREMENT_ID, { anonymize_ip: true });
  };

  const buildBanner = () => {
    const existing = document.getElementById('cookieBanner');
    if (existing) existing.remove();

    const banner = document.createElement('div');
    banner.className = 'cookie-banner';
    banner.id = 'cookieBanner';
    banner.setAttribute('role', 'region');
    banner.setAttribute('aria-label', 'Cookie consent');
    banner.innerHTML = `
      <div class="wrap cookie-banner-inner">
        <p>We use Google Analytics to see how visitors use this site — nothing sold, no ad tracking. <a href="privacy.html">Read our privacy policy</a>.</p>
        <div class="cookie-banner-actions">
          <button type="button" class="btn btn-secondary" id="cookieDecline">Decline</button>
          <button type="button" class="btn btn-primary" id="cookieAccept">Accept</button>
        </div>
      </div>
    `;
    document.body.appendChild(banner);

    document.getElementById('cookieAccept').addEventListener('click', () => {
      setConsent('accepted');
      loadGA4();
      banner.remove();
    });
    document.getElementById('cookieDecline').addEventListener('click', () => {
      setConsent('declined');
      banner.remove();
    });
  };

  const consent = getConsent();
  if (consent === 'accepted') {
    loadGA4();
  } else if (consent !== 'declined') {
    buildBanner();
  }

  // Footer "Cookie settings" button lets a visitor reopen this and change their choice any time.
  // The new-build step wires this button's id="cookieSettingsBtn" into the site's footer.
  document.addEventListener('DOMContentLoaded', () => {
    const settingsBtn = document.getElementById('cookieSettingsBtn');
    if (settingsBtn) settingsBtn.addEventListener('click', buildBanner);
  });
})();
