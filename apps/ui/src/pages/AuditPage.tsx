import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { spClient, type PendingItem } from '../lib/sp-client';
import { profileDisplayName } from '../lib/profile-display';
import { ProfileBadge } from '../components/ProfileBadge';
import { StatusBadge } from '../components/StatusBadge';
import { DomainBadge } from '../components/DomainBadge';
import { EmptyState } from '../components/EmptyState';

type Status = 'active' | 'pending' | 'expired';
type TimeRange = '1d' | '7d' | '30d' | 'all';

function getStatus(item: PendingItem): Status {
  if (item.remaining_seconds !== null && item.remaining_seconds <= 0) return 'expired';
  if (item.missing_domains.length > 0) return 'pending';
  return 'active';
}

function isWithinTimeRange(item: PendingItem, range: TimeRange): boolean {
  if (range === 'all') return true;
  const days = range === '1d' ? 1 : range === '7d' ? 7 : 30;
  const cutoff = Date.now() - days * 86400_000;
  return new Date(item.created_at).getTime() >= cutoff;
}

function matchesSearch(item: PendingItem, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return (
    item.profile_id.toLowerCase().includes(q) ||
    profileDisplayName(item.profile_id).toLowerCase().includes(q) ||
    item.path.toLowerCase().includes(q) ||
    item.frame_hash.toLowerCase().includes(q) ||
    item.required_domains.some(d => d.toLowerCase().includes(q)) ||
    item.attested_domains.some(d => d.toLowerCase().includes(q))
  );
}

export function AuditPage() {
  const { activeDomain } = useAuth();
  const [items, setItems] = useState<PendingItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & filter state
  const [search, setSearch] = useState('');
  const [statusFilters, setStatusFilters] = useState<Set<Status>>(new Set());
  const [profileFilters, setProfileFilters] = useState<Set<string>>(new Set());
  const [timeRange, setTimeRange] = useState<TimeRange>('all');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const fetchItems = useCallback(() => {
    if (!activeDomain) { setLoading(false); return; }
    setLoading(true);
    spClient.getPending(activeDomain)
      .then(setItems)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [activeDomain]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  // Derive available profiles from data
  const availableProfiles = useMemo(() => {
    const set = new Set<string>();
    for (const item of items) set.add(profileDisplayName(item.profile_id));
    return [...set].sort();
  }, [items]);

  // Apply all filters
  const filtered = useMemo(() => {
    return items.filter(item => {
      if (!matchesSearch(item, search)) return false;
      if (statusFilters.size > 0 && !statusFilters.has(getStatus(item))) return false;
      if (profileFilters.size > 0 && !profileFilters.has(profileDisplayName(item.profile_id))) return false;
      if (!isWithinTimeRange(item, timeRange)) return false;
      return true;
    });
  }, [items, search, statusFilters, profileFilters, timeRange]);

  // Active filter chips
  const hasActiveFilters = statusFilters.size > 0 || profileFilters.size > 0 || timeRange !== 'all';

  function toggleStatus(s: Status) {
    setStatusFilters(prev => {
      const next = new Set(prev);
      next.has(s) ? next.delete(s) : next.add(s);
      return next;
    });
  }

  function toggleProfile(p: string) {
    setProfileFilters(prev => {
      const next = new Set(prev);
      next.has(p) ? next.delete(p) : next.add(p);
      return next;
    });
  }

  function clearAllFilters() {
    setStatusFilters(new Set());
    setProfileFilters(new Set());
    setTimeRange('all');
    setSearch('');
  }

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Agent Receipts</h1>
        <p className="page-subtitle">Execution history and authorization events.</p>
      </div>

      {/* Search + Filter toggle row */}
      <div className="search-filter-bar">
        <div className="search-input-wrap">
          <span className="search-icon">&#x2315;</span>
          <input
            type="text"
            className="form-input search-input"
            placeholder="Search by profile, path, domain, or hash\u2026"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button className="search-clear" onClick={() => setSearch('')}>
              &times;
            </button>
          )}
        </div>
        <button
          className={`btn btn-sm btn-secondary${filtersOpen ? ' active' : ''}`}
          onClick={() => setFiltersOpen(!filtersOpen)}
        >
          Filters{hasActiveFilters ? ` (${statusFilters.size + profileFilters.size + (timeRange !== 'all' ? 1 : 0)})` : ''}
        </button>
      </div>

      {/* Expandable filter panel */}
      {filtersOpen && (
        <div className="filter-panel">
          {/* Status */}
          <div className="filter-section">
            <div className="filter-label">Status</div>
            <div className="filter-chips">
              {(['active', 'pending', 'expired'] as const).map(s => (
                <button
                  key={s}
                  className={`filter-chip${statusFilters.has(s) ? ' selected' : ''}`}
                  onClick={() => toggleStatus(s)}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Profile */}
          {availableProfiles.length > 1 && (
            <div className="filter-section">
              <div className="filter-label">Profile</div>
              <div className="filter-chips">
                {availableProfiles.map(p => (
                  <button
                    key={p}
                    className={`filter-chip${profileFilters.has(p) ? ' selected' : ''}`}
                    onClick={() => toggleProfile(p)}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Time range */}
          <div className="filter-section">
            <div className="filter-label">Time range</div>
            <div className="filter-chips">
              {([['1d', 'Today'], ['7d', '7 days'], ['30d', '30 days'], ['all', 'All time']] as const).map(([value, label]) => (
                <button
                  key={value}
                  className={`filter-chip${timeRange === value ? ' selected' : ''}`}
                  onClick={() => setTimeRange(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Active filter chips */}
      {hasActiveFilters && (
        <div className="active-filters">
          {[...statusFilters].map(s => (
            <span key={s} className="active-chip" onClick={() => toggleStatus(s)}>
              {s} <span className="chip-remove">&times;</span>
            </span>
          ))}
          {[...profileFilters].map(p => (
            <span key={p} className="active-chip" onClick={() => toggleProfile(p)}>
              {p} <span className="chip-remove">&times;</span>
            </span>
          ))}
          {timeRange !== 'all' && (
            <span className="active-chip" onClick={() => setTimeRange('all')}>
              {timeRange === '1d' ? 'Today' : timeRange === '7d' ? '7 days' : '30 days'} <span className="chip-remove">&times;</span>
            </span>
          )}
          <button className="clear-filters" onClick={clearAllFilters}>
            Clear all
          </button>
        </div>
      )}

      {loading ? (
        <p style={{ color: 'var(--text-tertiary)' }}>Loading...</p>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={'\u2315'}
          title={items.length === 0 ? 'No receipts yet' : 'No matching receipts'}
          text={items.length === 0
            ? 'Execution events will appear here after an agent uses an authorized tool.'
            : 'Try adjusting your search or filters.'}
        />
      ) : (
        <>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginBottom: '0.75rem' }}>
            {filtered.length === items.length
              ? `${items.length} receipt${items.length !== 1 ? 's' : ''}`
              : `${filtered.length} of ${items.length} receipts`}
          </div>
          <div className="timeline">
            {filtered.map(item => {
              const status = getStatus(item);
              return (
                <div className={`timeline-event${status === 'expired' ? ' expired' : ''}`} key={item.frame_hash}>
                  <div className="card" style={{ marginBottom: 0 }}>
                    <div className="auth-card-header">
                      <ProfileBadge profileId={item.profile_id} />
                      <span className="auth-card-path">{item.path}</span>
                      <StatusBadge status={status} />
                      <span className="auth-card-time">
                        {new Date(item.created_at).toLocaleString()}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                      {item.required_domains.map(d => (
                        <DomainBadge
                          key={d}
                          domain={d}
                          attested={item.attested_domains.includes(d)}
                        />
                      ))}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontFamily: "'SF Mono', Monaco, monospace", wordBreak: 'break-all' }}>
                      {item.frame_hash}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
