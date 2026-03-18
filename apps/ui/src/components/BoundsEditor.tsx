import { useState } from 'react';
import type { AgentProfile, AgentBoundsParams, AgentContextParams, AgentFrameParams } from '@hap/core';

interface Props {
  profile: AgentProfile;
  pathId: string;
  onConfirm: (bounds: AgentBoundsParams, context: AgentContextParams) => void;
  readOnly?: boolean;
  initialBounds?: AgentBoundsParams;
  initialContext?: AgentContextParams;
  // Keep old prop for compat
  initialFrame?: AgentFrameParams;
}

export function BoundsEditor({ profile, pathId, onConfirm, readOnly, initialBounds, initialContext, initialFrame }: Props) {
  const boundsSchema = profile.boundsSchema ?? profile.frameSchema;
  const contextSchema = profile.contextSchema;

  const boundsFields = boundsSchema
    ? Object.entries(boundsSchema.fields).filter(([key]) => key !== 'profile' && key !== 'path')
    : [];

  const contextFields = contextSchema && contextSchema.keyOrder.length > 0
    ? Object.entries(contextSchema.fields)
    : [];

  // Seed initial values from initialBounds, then initialFrame (legacy), then defaults
  const seedBounds = initialBounds ?? initialFrame ?? {};
  const seedContext = initialContext ?? {};

  const initialBoundsValues: Record<string, string> = {};
  for (const [key, fieldDef] of boundsFields) {
    if (seedBounds[key] !== undefined) {
      initialBoundsValues[key] = String(seedBounds[key]);
    } else {
      initialBoundsValues[key] = fieldDef.type === 'number' ? '0' : '';
    }
  }

  const initialContextValues: Record<string, string> = {};
  for (const [key, fieldDef] of contextFields) {
    if (seedContext[key] !== undefined) {
      initialContextValues[key] = String(seedContext[key]);
    } else {
      initialContextValues[key] = fieldDef.type === 'number' ? '0' : '';
    }
  }

  const [boundsValues, setBoundsValues] = useState<Record<string, string>>(initialBoundsValues);
  const [contextValues, setContextValues] = useState<Record<string, string>>(initialContextValues);

  const handleBoundsChange = (key: string, value: string) => {
    setBoundsValues(prev => ({ ...prev, [key]: value }));
  };

  const handleContextChange = (key: string, value: string) => {
    setContextValues(prev => ({ ...prev, [key]: value }));
  };

  const handleConfirm = () => {
    const bounds: AgentBoundsParams = {
      profile: profile.id,
      path: pathId,
    };

    for (const [key, fieldDef] of boundsFields) {
      if (fieldDef.type === 'number') {
        bounds[key] = Number(boundsValues[key]);
      } else {
        bounds[key] = boundsValues[key];
      }
    }

    const context: AgentContextParams = {};

    for (const [key, fieldDef] of contextFields) {
      if (fieldDef.type === 'number') {
        context[key] = Number(contextValues[key]);
      } else {
        context[key] = contextValues[key];
      }
    }

    onConfirm(bounds, context);
  };

  return (
    <div>
      <h3 className="card-title">
        {readOnly ? 'Review Bounds' : 'Set Bounds'}
      </h3>
      <p className="hint-text">
        Profile: <strong>{profile.id}</strong> &middot; Path: <strong>{pathId}</strong>
      </p>

      {boundsFields.length > 0 && (
        <>
          <div className="hint-text" style={{ fontWeight: 600, marginBottom: '0.5rem' }}>
            Bounds — sent to SP for enforcement
          </div>
          {boundsFields.map(([key, fieldDef]) => (
            <div className="form-group" key={`bounds-${key}`}>
              <label className="form-label" htmlFor={`bounds-field-${key}`}>
                {key}
              </label>
              {fieldDef.description && (
                <div className="hint-text">{fieldDef.description}</div>
              )}
              {'enum' in fieldDef && fieldDef.enum ? (
                <select
                  id={`bounds-field-${key}`}
                  className="form-select"
                  value={boundsValues[key]}
                  onChange={e => handleBoundsChange(key, e.target.value)}
                  disabled={readOnly}
                >
                  <option value="">Select...</option>
                  {fieldDef.enum.map((v: string) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              ) : (
                <input
                  id={`bounds-field-${key}`}
                  className="form-input"
                  type={fieldDef.type === 'number' ? 'number' : 'text'}
                  value={boundsValues[key]}
                  onChange={e => handleBoundsChange(key, e.target.value)}
                  disabled={readOnly}
                />
              )}
            </div>
          ))}
        </>
      )}

      {contextFields.length > 0 && (
        <>
          <div className="hint-text" style={{ fontWeight: 600, marginTop: '1rem', marginBottom: '0.5rem' }}>
            Context — stays local, encrypted
          </div>
          {contextFields.map(([key, fieldDef]) => (
            <div className="form-group" key={`context-${key}`}>
              <label className="form-label" htmlFor={`context-field-${key}`}>
                {key}
              </label>
              {fieldDef.description && (
                <div className="hint-text">{fieldDef.description}</div>
              )}
              {'enum' in fieldDef && fieldDef.enum ? (
                <select
                  id={`context-field-${key}`}
                  className="form-select"
                  value={contextValues[key]}
                  onChange={e => handleContextChange(key, e.target.value)}
                  disabled={readOnly}
                >
                  <option value="">Select...</option>
                  {fieldDef.enum.map((v: string) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              ) : (
                <input
                  id={`context-field-${key}`}
                  className="form-input"
                  type={fieldDef.type === 'number' ? 'number' : 'text'}
                  value={contextValues[key]}
                  onChange={e => handleContextChange(key, e.target.value)}
                  disabled={readOnly}
                />
              )}
            </div>
          ))}
        </>
      )}

      <button className="btn btn-primary" onClick={handleConfirm}>
        {readOnly ? 'Next: Gates' : 'Next: Problem Statement'}
      </button>
    </div>
  );
}
