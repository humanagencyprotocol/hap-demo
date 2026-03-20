import { useState, useEffect } from 'react';
import { spClient, type IntegrationManifest, type McpIntegrationStatus } from '../lib/sp-client';

const ICON_MAP: Record<string, string> = {
  card: '\u{1F4B3}',
  mail: '\u2709\uFE0F',
};

interface Props {
  manifest: IntegrationManifest;
  integration: McpIntegrationStatus | undefined;
  onStatusChange: () => void;
  onSuccess: (msg: string) => void;
}

type CardState = 'unconfigured' | 'needs-oauth' | 'ready' | 'running';

export function IntegrationCard({ manifest, integration, onStatusChange, onSuccess }: Props) {
  const [credValues, setCredValues] = useState<Record<string, string>>({});
  const [credConfigured, setCredConfigured] = useState(false);
  const [oauthConnected, setOauthConnected] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activating, setActivating] = useState(false);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});

  useEffect(() => {
    // Check if credentials exist
    spClient.getCredential(manifest.id).then(status => {
      if (status.configured) {
        setCredConfigured(true);
        // Check if OAuth token exists
        if (manifest.oauth) {
          setOauthConnected(status.fieldNames?.includes(manifest.oauth.tokenStorage) ?? false);
        }
      }
    }).catch(() => {/* ignore */});
  }, [manifest.id, manifest.oauth]);

  const cardState: CardState = (() => {
    if (integration?.running) return 'running';
    if (!credConfigured) return 'unconfigured';
    if (manifest.oauth && !oauthConnected) return 'needs-oauth';
    return 'ready';
  })();

  const saveCredentials = async () => {
    const hasValues = manifest.credentials.fields.some(f => credValues[f.key]?.trim());
    if (!hasValues) return;
    setSaving(true);
    try {
      await spClient.setCredential(manifest.id, credValues);
      setCredConfigured(true);
      setCredValues({});
      onSuccess(`${manifest.name} credentials saved!`);
    } catch {
      onSuccess(`Failed to save ${manifest.name} credentials`);
    } finally {
      setSaving(false);
    }
  };

  const startOAuth = () => {
    window.open(`/auth/oauth/${manifest.id}/start`, '_blank', 'width=600,height=700');
    const poll = setInterval(async () => {
      try {
        const cred = await spClient.getCredential(manifest.id);
        if (cred.configured && manifest.oauth && cred.fieldNames?.includes(manifest.oauth.tokenStorage)) {
          setOauthConnected(true);
          clearInterval(poll);
          onSuccess(`${manifest.name} connected!`);
        }
      } catch { /* ignore */ }
    }, 2000);
    setTimeout(() => clearInterval(poll), 120000);
  };

  const activate = async () => {
    setActivating(true);
    try {
      const result = await spClient.activateIntegration(manifest.id);
      if (result.warning) {
        onSuccess(result.warning);
      } else {
        onSuccess(`${manifest.name} integration started with ${result.tools.length} tools`);
      }
      onStatusChange();
    } catch (err) {
      onSuccess(`Failed to start ${manifest.name}: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setActivating(false);
    }
  };

  const remove = async () => {
    try {
      await spClient.removeMcpIntegration(manifest.id);
      onSuccess(`${manifest.name} integration removed`);
      onStatusChange();
    } catch {
      onSuccess(`Failed to remove ${manifest.name}`);
    }
  };

  const icon = ICON_MAP[manifest.icon] ?? '\u{1F527}';

  return (
    <div className="card" style={{ marginBottom: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
        <span style={{ fontSize: '1.5rem' }}>{icon}</span>
        <div style={{ flex: 1 }}>
          <h3 className="card-title" style={{ margin: 0 }}>{manifest.name}</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
            {manifest.description}
          </p>
        </div>
        {manifest.profile && <span className="profile-badge">{manifest.profile}</span>}
      </div>

      {/* Running state */}
      {cardState === 'running' && integration && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="service-status service-status-connected">
            <span className="service-status-dot" />
            Running ({integration.toolCount} tools)
          </div>
          <button
            className="btn btn-sm btn-ghost"
            style={{ color: 'var(--danger)' }}
            onClick={remove}
          >
            Stop
          </button>
        </div>
      )}

      {/* Unconfigured state — show credential form */}
      {cardState === 'unconfigured' && (
        <>
          {manifest.setupHint && (
            <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginBottom: '0.75rem' }}>
              {manifest.setupHint}
            </p>
          )}
          {manifest.credentials.fields.map(field => (
            <div className="form-group" key={field.key} style={{ marginBottom: '0.75rem' }}>
              <label className="form-label">{field.label}</label>
              {field.type === 'password' ? (
                <div className="cred-field">
                  <input
                    className="form-input"
                    type={showSecrets[field.key] ? 'text' : 'password'}
                    placeholder={field.placeholder}
                    value={credValues[field.key] || ''}
                    onChange={e => setCredValues(v => ({ ...v, [field.key]: e.target.value }))}
                  />
                  <button
                    className="cred-toggle"
                    onClick={() => setShowSecrets(s => ({ ...s, [field.key]: !s[field.key] }))}
                  >
                    {showSecrets[field.key] ? 'hide' : 'show'}
                  </button>
                </div>
              ) : (
                <input
                  className="form-input"
                  type="text"
                  placeholder={field.placeholder}
                  value={credValues[field.key] || ''}
                  onChange={e => setCredValues(v => ({ ...v, [field.key]: e.target.value }))}
                />
              )}
            </div>
          ))}
          <button
            className="btn btn-primary"
            onClick={saveCredentials}
            disabled={saving || !manifest.credentials.fields.some(f => credValues[f.key]?.trim())}
          >
            {saving ? 'Saving...' : 'Save & Encrypt'}
          </button>
        </>
      )}

      {/* Needs OAuth */}
      {cardState === 'needs-oauth' && (
        <>
          <div style={{ fontSize: '0.8rem', color: 'var(--success)', marginBottom: '0.75rem' }}>
            {'\u2713'} Credentials configured
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={startOAuth}>
              Connect {manifest.name} Account
            </button>
            <button className="btn btn-ghost" onClick={() => setCredConfigured(false)}>
              Change Credentials
            </button>
          </div>
        </>
      )}

      {/* Ready to start */}
      {cardState === 'ready' && !integration && (
        <>
          <div style={{ fontSize: '0.8rem', color: 'var(--success)', marginBottom: '0.75rem' }}>
            {'\u2713'} {manifest.oauth ? `${manifest.name} account connected` : 'Credentials configured'}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              className="btn btn-primary"
              onClick={activate}
              disabled={activating}
            >
              {activating ? 'Starting...' : `Start ${manifest.name} Integration`}
            </button>
            {!manifest.oauth && (
              <button className="btn btn-ghost" onClick={() => setCredConfigured(false)}>
                Update Credentials
              </button>
            )}
            {manifest.oauth && (
              <button className="btn btn-ghost" onClick={() => { setCredConfigured(false); setOauthConnected(false); }}>
                Change Credentials
              </button>
            )}
          </div>
        </>
      )}

      {/* Stopped but registered — offer restart */}
      {cardState === 'ready' && integration && !integration.running && (
        <>
          <div className="service-status service-status-error" style={{ marginBottom: '0.75rem' }}>
            <span className="service-status-dot" />
            Stopped
          </div>
          {integration.error && (
            <div style={{ fontSize: '0.8rem', color: 'var(--danger)', marginBottom: '0.75rem' }}>
              {integration.error}
            </div>
          )}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-primary" onClick={activate} disabled={activating}>
              {activating ? 'Starting...' : 'Restart'}
            </button>
            <button className="btn btn-ghost" style={{ color: 'var(--danger)' }} onClick={remove}>
              Remove
            </button>
          </div>
        </>
      )}
    </div>
  );
}
