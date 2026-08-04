import Script from "next/script";

const navItems = [
  {
    route: "overview",
    label: "Overview",
    icon: <><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v9.5h13V10"/></>,
  },
  {
    route: "sessions",
    label: "Sessions",
    icon: <><path d="M9 3h6"/><path d="M10 3v6l-5.5 9.5A2 2 0 0 0 6.2 21h11.6a2 2 0 0 0 1.7-3L14 9V3"/></>,
  },
  {
    route: "glossary",
    label: "BioAtlas",
    icon: <><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></>,
  },
];

export default function Home() {
  return (
    <>
      <div className="shell">
        <aside className="sidebar">
          <a href="#/overview" className="brand" aria-label="The OVAITY BioAtlas home">
            <img className="brand-logo" src="/logo.png" alt="OVAITY" height="26" />
          </a>
          <span className="brand-tag">BioAtlas</span>
          <span className="brand-powered">Powered by OVAITY</span>

          <nav className="side-nav" id="tabs" aria-label="Primary navigation">
            {navItems.map((item) => (
              <a key={item.route} href={`#/${item.route}`} data-route={item.route}>
                <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                  {item.icon}
                </svg>
                {item.label}
              </a>
            ))}
          </nav>

          <a
            className="sidebar-cta"
            href="https://www.ovaity.com/#waitlist"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Join the OVAITY waitlist (opens in a new tab)"
          >
            <span>Building or managing life-science research?</span>
            <strong>Join the OVAITY waitlist <span aria-hidden="true">&rarr;</span></strong>
          </a>

          <div className="sidebar-foot">
            <div className="foot-stat"><span id="foot-terms">0</span> terms</div>
            <div className="foot-stat"><span id="foot-methods">0</span> methods</div>
            <button className="theme-toggle" id="theme-toggle" type="button" aria-label="Switch color theme" title="Switch color theme">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M20.4 15.3A8 8 0 0 1 8.7 3.6 8.5 8.5 0 1 0 20.4 15.3Z"/></svg>
            </button>
          </div>
        </aside>

        <div className="content-area">
          <main id="app" aria-live="polite" />
        </div>
      </div>

      <Script src="/data/data.js" strategy="afterInteractive" />
      <Script src="/data/videos.js" strategy="afterInteractive" />
      <Script src="/app.js" strategy="afterInteractive" />
    </>
  );
}
