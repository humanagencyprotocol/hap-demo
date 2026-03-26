import { NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useState, useEffect } from 'react';
import { spClient } from '../lib/sp-client';

interface NavItem {
  to: string;
  icon: string;
  label: string;
  statusKey?: 'integrations' | 'assistant';
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', icon: '\u25A1', label: 'Dashboard' },
  { to: '/agent/new', icon: '\u25C8', label: 'Authorize Agents' },
  { to: '/authorizations', icon: '\u2630', label: 'Agent Authorizations' },
  { to: '/audit', icon: '\u25A3', label: 'Agent Receipts' },
  { to: '/groups', icon: '\u25C9', label: 'Manage Groups' },
  { to: '/integrations', icon: '\u29D7', label: 'Integrations', statusKey: 'integrations' },
  { to: '/settings', icon: '\u2699', label: 'AI Assistant', statusKey: 'assistant' },
];

function useNavStatus() {
  const [integrationStatus, setIntegrationStatus] = useState<'ok' | 'warn' | null>(null);
  const [assistantStatus, setAssistantStatus] = useState<'ok' | 'warn' | null>(null);

  useEffect(() => {
    async function poll() {
      try {
        const [intData, healthData] = await Promise.all([
          spClient.getMcpIntegrations().catch(() => null),
          spClient.getMcpHealth().catch(() => null),
        ]);

        // Integrations: green if any running, red if none or any stopped
        if (intData?.integrations) {
          const all = intData.integrations;
          if (all.length === 0) {
            setIntegrationStatus(null);
          } else {
            const allRunning = all.every(i => i.running);
            setIntegrationStatus(allRunning ? 'ok' : 'warn');
          }
        }

        // AI Assistant: green if active sessions, yellow if none
        if (healthData) {
          setAssistantStatus(healthData.activeSessions > 0 ? 'ok' : 'warn');
        }
      } catch {
        // Ignore errors
      }
    }

    poll();
    const interval = setInterval(poll, 15000);
    return () => clearInterval(interval);
  }, []);

  return { integrations: integrationStatus, assistant: assistantStatus };
}

function statusColor(status: 'ok' | 'warn' | null): string | undefined {
  if (status === 'ok') return 'var(--success)';
  if (status === 'warn') return 'var(--warning)';
  return undefined;
}

export function Sidebar() {
  const { activeGroup, activeDomain } = useAuth();
  const navStatus = useNavStatus();

  return (
    <div className="sidebar">
      <ul className="sidebar-nav">
        {NAV_ITEMS.map(item => {
          const status = item.statusKey ? navStatus[item.statusKey] : null;
          const color = statusColor(status);
          return (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) => `sidebar-item${isActive ? ' active' : ''}`}
              >
                <span className="icon" style={color ? { color } : undefined}>{item.icon}</span> {item.label}
              </NavLink>
            </li>
          );
        })}
      </ul>
      <div className="sidebar-context">
        <div className="ctx-label">Active context</div>
        <div className="ctx-value">
          {activeGroup ? `${activeGroup.name} / ${activeDomain}` : activeDomain || 'Not set'}
        </div>
      </div>
    </div>
  );
}
