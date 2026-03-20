import { useState, useEffect, useCallback } from 'react';
import { spClient } from '../lib/sp-client';

const PROVIDER_CONFIG: Record<string, { provider: string; endpoint: string; models: string[] }> = {
  ollama: {
    provider: 'ollama',
    endpoint: 'http://localhost:11434',
    models: ['llama3.2', 'llama3.1', 'mistral', 'codellama', 'gemma2', 'phi3', 'qwen2.5'],
  },
  openai: {
    provider: 'openai-compatible',
    endpoint: 'https://api.openai.com/v1',
    models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo', 'o3-mini'],
  },
  groq: {
    provider: 'openai-compatible',
    endpoint: 'https://api.groq.com/openai/v1',
    models: ['llama-3.1-8b-instant', 'llama-3.3-70b-versatile', 'gemma2-9b-it', 'mixtral-8x7b-32768'],
  },
  together: {
    provider: 'openai-compatible',
    endpoint: 'https://api.together.xyz/v1',
    models: ['meta-llama/Llama-3-8b-chat-hf', 'meta-llama/Llama-3-70b-chat-hf', 'mistralai/Mixtral-8x7B-Instruct-v0.1'],
  },
  openrouter: {
    provider: 'openai-compatible',
    endpoint: 'https://openrouter.ai/api/v1',
    models: ['anthropic/claude-sonnet-4', 'anthropic/claude-haiku-4', 'openai/gpt-4o-mini', 'openai/gpt-4o', 'google/gemini-2.5-flash', 'meta-llama/llama-3.1-8b-instruct'],
  },
};

export function SettingsServicesPage() {
  const [successMsg, setSuccessMsg] = useState('');

  // AI config state
  const [aiPreset, setAiPreset] = useState('ollama');
  const [aiProvider, setAiProvider] = useState('ollama');
  const [aiEndpoint, setAiEndpoint] = useState('http://localhost:11434');
  const [aiModel, setAiModel] = useState('llama3.2');
  const [aiApiKey, setAiApiKey] = useState('');
  const [aiConfigured, setAiConfigured] = useState(false);
  const [aiSaving, setAiSaving] = useState(false);
  const [aiTesting, setAiTesting] = useState(false);
  const [aiTestResult, setAiTestResult] = useState<string | null>(null);

  // GitHub PAT state
  const [ghPat, setGhPat] = useState('');
  const [ghConfigured, setGhConfigured] = useState(false);
  const [ghSaving, setGhSaving] = useState(false);
  const [ghTesting, setGhTesting] = useState(false);
  const [ghTestResult, setGhTestResult] = useState<string | null>(null);

  const showSuccess = useCallback((msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3000);
  }, []);

  const loadStatus = useCallback(async () => {
    try {
      const [aiStatus, ghStatus] = await Promise.all([
        spClient.getCredential('ai-config'),
        spClient.getCredential('github-pat'),
      ]);
      setAiConfigured(aiStatus.configured);
      setGhConfigured(ghStatus.configured);
      if (aiStatus.configured && aiStatus.fields) {
        if (aiStatus.fields.provider) setAiProvider(aiStatus.fields.provider);
        if (aiStatus.fields.endpoint) setAiEndpoint(aiStatus.fields.endpoint);
        if (aiStatus.fields.model) setAiModel(aiStatus.fields.model);
        const ep = aiStatus.fields.endpoint ?? '';
        if (ep.includes('openai.com')) setAiPreset('openai');
        else if (ep.includes('groq.com')) setAiPreset('groq');
        else if (ep.includes('together.xyz')) setAiPreset('together');
        else if (ep.includes('openrouter.ai')) setAiPreset('openrouter');
        else setAiPreset('ollama');
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const handleAiPresetChange = (preset: string) => {
    setAiPreset(preset);
    const cfg = PROVIDER_CONFIG[preset];
    if (cfg) {
      setAiProvider(cfg.provider);
      setAiEndpoint(cfg.endpoint);
      setAiModel(cfg.models[0]);
    }
  };

  const saveAiConfig = async () => {
    setAiSaving(true);
    try {
      await spClient.setCredential('ai-config', {
        provider: aiProvider,
        endpoint: aiEndpoint,
        model: aiModel,
        ...(aiApiKey ? { apiKey: aiApiKey } : {}),
      });
      setAiConfigured(true);
      showSuccess('AI configuration saved!');
    } catch {
      showSuccess('Failed to save AI config');
    } finally {
      setAiSaving(false);
    }
  };

  const testAi = async () => {
    setAiTesting(true);
    setAiTestResult(null);
    try {
      const result = await spClient.aiTest(aiApiKey ? {
        provider: aiProvider,
        endpoint: aiEndpoint,
        model: aiModel,
        apiKey: aiApiKey,
      } : {});
      setAiTestResult(result.ok ? `OK: ${result.message}` : `Failed: ${result.message}`);
    } catch (e) {
      setAiTestResult(`Error: ${e instanceof Error ? e.message : 'Unknown'}`);
    } finally {
      setAiTesting(false);
    }
  };

  const saveGhPat = async () => {
    setGhSaving(true);
    try {
      await spClient.setCredential('github-pat', { pat: ghPat });
      setGhConfigured(true);
      setGhPat('');
      showSuccess('GitHub PAT saved!');
    } catch {
      showSuccess('Failed to save GitHub PAT');
    } finally {
      setGhSaving(false);
    }
  };

  const testGh = async () => {
    setGhTesting(true);
    setGhTestResult(null);
    try {
      const result = await spClient.testCredential('github-pat');
      setGhTestResult(result.ok ? `OK: ${result.message}` : `Failed: ${result.message}`);
    } catch (e) {
      setGhTestResult(`Error: ${e instanceof Error ? e.message : 'Unknown'}`);
    } finally {
      setGhTesting(false);
    }
  };

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">AI assistant and GitHub configuration.</p>
      </div>

      {/* Vault banner */}
      <div className="status-banner status-banner-success">
        <span className="status-banner-icon">{'\u{1F512}'}</span>
        <span className="status-banner-text">
          Vault is active. Credentials are encrypted locally before storage.
        </span>
      </div>

      {successMsg && <div className="alert alert-success">{successMsg}</div>}

      {/* AI Assistant card */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3 className="card-title">AI Assistant</h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
          Advisory-only AI to help you think through gates. Keys are encrypted in your vault.
        </p>

        {aiConfigured && (
          <div className="status-banner status-banner-success" style={{ marginBottom: '1rem', fontSize: '0.8rem' }}>
            <span className="status-banner-icon">{'\u2713'}</span>
            <span className="status-banner-text">AI configured</span>
          </div>
        )}

        <div className="form-group" style={{ marginBottom: '0.75rem' }}>
          <label className="form-label">Provider Preset</label>
          <select
            className="form-input"
            value={aiPreset}
            onChange={e => handleAiPresetChange(e.target.value)}
          >
            <option value="ollama">Ollama (local)</option>
            <option value="openai">OpenAI</option>
            <option value="groq">Groq</option>
            <option value="together">Together</option>
            <option value="openrouter">OpenRouter</option>
          </select>
        </div>

        <div className="form-group" style={{ marginBottom: '0.75rem' }}>
          <label className="form-label">Model</label>
          {(() => {
            const models = PROVIDER_CONFIG[aiPreset]?.models ?? [];
            const isKnown = models.includes(aiModel);
            return (
              <>
                <select
                  className="form-input"
                  value={isKnown ? aiModel : '__custom__'}
                  onChange={e => {
                    if (e.target.value === '__custom__') {
                      setAiModel('');
                    } else {
                      setAiModel(e.target.value);
                    }
                  }}
                  style={{ marginBottom: !isKnown ? '0.375rem' : undefined }}
                >
                  {models.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                  <option value="__custom__">Custom model...</option>
                </select>
                {!isKnown && (
                  <input
                    className="form-input"
                    value={aiModel}
                    onChange={e => setAiModel(e.target.value)}
                    placeholder="Enter model name"
                  />
                )}
              </>
            );
          })()}
        </div>

        <div className="form-group" style={{ marginBottom: '1rem' }}>
          <label className="form-label">API Key (if required)</label>
          <input
            className="form-input"
            type="password"
            value={aiApiKey}
            onChange={e => setAiApiKey(e.target.value)}
            placeholder={aiConfigured ? '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022' : 'sk-... (not needed for Ollama)'}
          />
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button className="btn btn-primary" onClick={saveAiConfig} disabled={aiSaving}>
            {aiSaving ? 'Saving...' : 'Save & Encrypt'}
          </button>
          {aiConfigured && (
            <button className="btn btn-ghost" onClick={testAi} disabled={aiTesting}>
              {aiTesting ? 'Testing...' : 'Test Connection'}
            </button>
          )}
        </div>

        {aiTestResult && (
          <div className={`alert ${aiTestResult.startsWith('OK') ? 'alert-success' : 'alert-error'}`} style={{ marginTop: '0.75rem' }}>
            {aiTestResult}
          </div>
        )}
      </div>

      {/* GitHub Access card */}
      <div className="card">
        <h3 className="card-title">GitHub Access</h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
          Personal access token for loading PRs in the deploy review flow. Encrypted in your vault.
        </p>

        <details style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem', cursor: 'pointer' }}>
          <summary style={{ fontWeight: 500, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
            How to create a GitHub Personal Access Token
          </summary>
          <ol style={{ paddingLeft: '1.25rem', lineHeight: 1.7, marginTop: '0.5rem' }}>
            <li>Go to <strong>GitHub.com</strong> &rarr; click your profile picture &rarr; <strong>Settings</strong></li>
            <li>Scroll down in the left sidebar &rarr; <strong>Developer settings</strong></li>
            <li>Click <strong>Personal access tokens</strong> &rarr; <strong>Fine-grained tokens</strong></li>
            <li>Click <strong>Generate new token</strong></li>
            <li>Give it a name (e.g. "HAP Demo") and set an expiration</li>
            <li>Under <strong>Repository access</strong>, select the repos you want to review</li>
            <li>Under <strong>Permissions</strong>, grant: <strong>Pull requests</strong> (Read) and <strong>Contents</strong> (Read)</li>
            <li>Click <strong>Generate token</strong> and copy the <code>github_pat_...</code> value</li>
            <li>Paste it below and click <strong>Save &amp; Encrypt</strong></li>
          </ol>
        </details>

        {ghConfigured && (
          <div className="status-banner status-banner-success" style={{ marginBottom: '1rem', fontSize: '0.8rem' }}>
            <span className="status-banner-icon">{'\u2713'}</span>
            <span className="status-banner-text">GitHub PAT configured</span>
          </div>
        )}

        <div className="form-group" style={{ marginBottom: '1rem' }}>
          <label className="form-label">Personal Access Token</label>
          <input
            className="form-input"
            type="password"
            value={ghPat}
            onChange={e => setGhPat(e.target.value)}
            placeholder={ghConfigured ? '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022' : 'ghp_...'}
          />
        </div>

        {ghTestResult && (
          <div className={`alert ${ghTestResult.startsWith('OK') ? 'alert-success' : 'alert-error'}`} style={{ marginBottom: '0.75rem' }}>
            {ghTestResult}
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-ghost" onClick={testGh} disabled={ghTesting || !ghConfigured}>
            {ghTesting ? 'Testing...' : 'Test Connection'}
          </button>
          <button className="btn btn-primary" onClick={saveGhPat} disabled={ghSaving || !ghPat}>
            {ghSaving ? 'Saving...' : 'Save & Encrypt'}
          </button>
        </div>
      </div>
    </>
  );
}
