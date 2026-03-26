import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../hooks/useTheme';

const THEME_ICONS: Record<string, string> = {
  system: '\u25D1',
  light: '\u2600',
  dark: '\u263E',
};

function DomainSwitcher() {
  const { groups, activeGroup, activeDomain, setActiveContext } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Build list of all available contexts: single-domain + each group's domains
  type ContextOption = { label: string; group: typeof activeGroup; domain: string };
  const options: ContextOption[] = [];

  // Single domain (no group) — use current activeDomain or 'personal' as fallback
  options.push({ label: 'personal', group: null, domain: activeDomain || 'personal' });

  for (const g of groups) {
    for (const d of g.myDomains) {
      options.push({ label: `${g.name} / ${d}`, group: g, domain: d });
    }
  }

  // Don't show switcher if only one option
  if (options.length <= 1 && groups.length === 0) {
    return <span>{activeDomain || 'personal'}</span>;
  }

  const currentLabel = activeGroup
    ? `${activeGroup.name} / ${activeDomain}`
    : activeDomain || 'personal';

  return (
    <div className="domain-switcher" ref={ref}>
      <button className="domain-switcher-btn" onClick={() => setOpen(!open)}>
        {currentLabel}
        <span className="domain-switcher-arrow">{open ? '\u25B4' : '\u25BE'}</span>
      </button>
      {open && (
        <div className="domain-switcher-menu">
          {options.map((opt, i) => (
            <button
              key={i}
              className={`domain-switcher-item${opt.group?.id === activeGroup?.id && opt.domain === activeDomain ? ' active' : ''}`}
              onClick={() => { setActiveContext(opt.group, opt.domain); setOpen(false); }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface TopNavProps {
  onMenuToggle?: () => void;
}

export function TopNav({ onMenuToggle }: TopNavProps) {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();

  return (
    <nav className="top-nav">
      <div className="top-nav-inner">
        <div className="logo-group">
          <span className="logo">HAP</span>
          <span className="version-badge">Alpha</span>
        </div>
        <div className="nav-spacer" />
        <div className="nav-actions nav-actions-desktop">
          {user ? (
            <>
              <span className="user-chip">
                <strong>{user.name}</strong>
                <span className="dot" />
                <DomainSwitcher />
              </span>
              <button className="theme-toggle" onClick={toggle} title={`Theme: ${theme}`}>
                {THEME_ICONS[theme]}
              </button>
              <button className="nav-logout" onClick={logout}>Logout</button>
            </>
          ) : (
            <>
              <a href="https://humanagencyprotocol.org" target="_blank" rel="noopener noreferrer"
                style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
                What is HAP?
              </a>
              <button className="theme-toggle" onClick={toggle} title={`Theme: ${theme}`}>
                {THEME_ICONS[theme]}
              </button>
            </>
          )}
        </div>
        {user && onMenuToggle && (
          <button className="mobile-menu-btn" onClick={onMenuToggle} aria-label="Menu">
            {'\u2630'}
          </button>
        )}
      </div>
    </nav>
  );
}
