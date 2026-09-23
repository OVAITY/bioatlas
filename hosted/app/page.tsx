import Image from "next/image";
import Script from "next/script";
import type { ReactNode } from "react";

type NavItem = { route: string; label: string; icon: ReactNode };
type NavSection = { id: string; label: string; items: NavItem[] };

const homeItem: NavItem = {
  route: "overview",
  label: "Home",
  icon: (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5.5 10v9.5h13V10" />
    </svg>
  ),
};

const navSections: NavSection[] = [
  {
    id: "learn",
    label: "Learn",
    items: [
      {
        route: "learn",
        label: "Learning Hub",
        icon: (
          <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
            <path d="M12 6c-2.2-1.6-4.8-2.4-8-2.4v14.2c3.2 0 5.8.8 8 2.4" />
            <path d="M12 6c2.2-1.6 4.8-2.4 8-2.4v14.2c-3.2 0-5.8.8-8 2.4" />
            <path d="M12 6v14.2" />
          </svg>
        ),
      },
      {
        route: "sessions",
        label: "Sessions",
        icon: (
          <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
            <path d="M9 3h6" />
            <path d="M10 3v6l-5.5 9.5A2 2 0 0 0 6.2 21h11.6a2 2 0 0 0 1.7-3L14 9V3" />
          </svg>
        ),
      },
    ],
  },
  {
    id: "explore",
    label: "Explore",
    items: [
      {
        route: "glossary",
        label: "Atlas",
        icon: (
          <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
        ),
      },
      {
        route: "models",
        label: "Models",
        icon: (
          <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
            <circle cx="12" cy="12" r="2.3" />
            <circle cx="12" cy="4" r="1.6" />
            <circle cx="19.5" cy="16" r="1.6" />
            <circle cx="4.5" cy="16" r="1.6" />
            <path d="M12 6.3v3.4M13.9 13.3l4 1.9M10.1 13.3l-4 1.9" />
          </svg>
        ),
      },
      {
        route: "structures",
        label: "Structures",
        icon: (
          <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
            <path d="M12 3 20 7.5v9L12 21 4 16.5v-9L12 3Z" />
            <path d="M12 12 20 7.5M12 12v9M12 12 4 7.5" />
          </svg>
        ),
      },
    ],
  },
  {
    id: "discover",
    label: "Discover",
    items: [
      {
        route: "intelligence",
        label: "Intelligence",
        icon: (
          <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
            <path d="M4 17c2-6 4-6 6 0s4 6 6 0 4-6 6 0" />
            <path d="M4 9c2-6 4-6 6 0s4 6 6 0 4-6 6 0" />
          </svg>
        ),
      },
    ],
  },
];

function NavLink({ item }: { item: NavItem }) {
  return (
    <a href={`/#/${item.route}`} data-route={item.route} title={item.label}>
      {item.icon}
      {item.label}
    </a>
  );
}

export default function Home() {
  return (
    <>
      <div className="shell">
        <aside className="sidebar">
          <a href="https://www.ovaity.com" className="brand" aria-label="Visit the OVAITY website">
            <Image className="brand-logo" src="/logo.png" alt="OVAITY" width={81} height={26} priority />
          </a>
          <span className="brand-tag">BioAtlas</span>
          <span className="brand-powered">Powered by OVAITY</span>

          <nav className="side-nav" id="tabs" aria-label="Primary navigation">
            <NavLink item={homeItem} />
            {navSections.map((section) => (
              <div key={section.id} className="nav-section" role="group" aria-labelledby={`nav-${section.id}`}>
                <span id={`nav-${section.id}`} className="nav-section-label">
                  {section.label}
                </span>
                {section.items.map((item) => (
                  <NavLink key={item.route} item={item} />
                ))}
              </div>
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

      <Script src="/app.js?v=20260923-6" strategy="afterInteractive" />
    </>
  );
}
