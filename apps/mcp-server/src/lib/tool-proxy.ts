/**
 * Tool Proxy — HAP gating wrapper for proxied tool calls.
 *
 * Wraps downstream MCP tool calls with HAP authorization verification.
 * For gated tools, auto-selects the best matching authorization from active ones.
 */

import type { IntegrationManager, DiscoveredTool } from './integration-manager';
import type { SharedState, EnrichedAuthorization } from './shared-state';
import { SPReceiptError } from './sp-client';

/** Match a short profile name (e.g. "spend") against a full qualified ID (e.g. "github.com/.../spend@0.3") */
export function profileMatches(profileId: string, shortName: string): boolean {
  return profileId === shortName || profileId.includes('/' + shortName + '@') || profileId.endsWith('/' + shortName);
}

type ToolResult = {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
};

/**
 * Create a handler function for a proxied tool that gates calls through HAP.
 *
 * - If `tool.gating` is null → proxy directly (ungated/read-only tool)
 * - If gated → build execution context, find matching authorization, verify, then proxy
 */
export function createGatedToolHandler(
  tool: DiscoveredTool,
  integrationManager: IntegrationManager,
  state: SharedState,
): (args: Record<string, unknown>) => Promise<ToolResult> {
  // Ungated tools: proxy directly
  if (!tool.gating || !tool.gating.profile) {
    return async (args: Record<string, unknown>) => {
      return integrationManager.callTool(tool.integrationId, tool.originalName, args);
    };
  }

  const { profile, executionMapping, staticExecution } = tool.gating;

  return async (args: Record<string, unknown>) => {
    // Start with static values (e.g., scope: "external")
    const execution: Record<string, string | number> = { ...staticExecution };

    // Build execution context from tool args using the mapping
    for (const [argName, mapping] of Object.entries(executionMapping)) {
      const value = args[argName];
      if (value !== undefined && value !== null) {
        if (typeof mapping === 'string') {
          // Direct mapping: argName → contextField
          execution[mapping] = typeof value === 'number' ? value : String(value);
        } else {
          // Divisor mapping: convert units (e.g., cents ÷ 100 → EUR)
          const numValue = typeof value === 'number' ? value : Number(value);
          execution[mapping.field] = numValue / mapping.divisor;
        }
      }
    }

    // Find all active authorizations matching this profile
    const auths = state.getEnrichedAuthorizations();
    const matchingAuths = auths.filter(
      a => a.complete && profileMatches(a.profileId, profile),
    );

    if (matchingAuths.length === 0) {
      return {
        content: [{
          type: 'text',
          text: `No active authorization matching profile "${profile}". ` +
            `A decision owner must grant authority via the Authority UI before this tool can be used.`,
        }],
        isError: true,
      };
    }

    // Try each matching authorization until one passes verification
    const errors: string[] = [];
    for (const auth of matchingAuths) {
      const { result } = await state.gatekeeper.verifyExecution(auth.path, execution);

      if (result.approved) {
        // Request receipt from SP (pre-flight — fail closed)
        try {
          await state.spClient.postReceipt({
            attestationHash: auth.frameHash,
            profileId: auth.profileId,
            path: auth.path,
            action: String(execution.action_type ?? tool.originalName),
            executionContext: { ...execution },
            amount: typeof execution.amount === 'number' ? execution.amount : undefined,
          });
        } catch (err) {
          if (err instanceof SPReceiptError && err.statusCode === 403) {
            // SP rejected — limit exceeded or revoked
            return {
              content: [{ type: 'text', text: `Blocked by SP: ${err.message}` }],
              isError: true,
            };
          }
          // SP unreachable — fail closed
          return {
            content: [{ type: 'text', text: `SP unavailable — tool call blocked. ${err instanceof Error ? err.message : ''}` }],
            isError: true,
          };
        }

        // Record execution in log for cumulative tracking
        state.executionLog.record({
          profileId: auth.profileId,
          path: auth.path,
          execution: { ...execution },
          timestamp: Math.floor(Date.now() / 1000),
        });

        // Authorization verified — proxy the call
        return integrationManager.callTool(tool.integrationId, tool.originalName, args);
      }

      // Collect rejection reasons
      const reasons = result.errors.map(e => {
        if (e.code === 'BOUND_EXCEEDED') {
          return `${auth.path}: ${e.field}: ${e.message}`;
        }
        return `${auth.path}: ${e.message}`;
      });
      errors.push(...reasons);
    }

    // All authorizations failed
    return {
      content: [{
        type: 'text',
        text: `Tool call rejected by Gatekeeper. Tried ${matchingAuths.length} authorization(s):\n` +
          errors.map(e => `  - ${e}`).join('\n'),
      }],
      isError: true,
    };
  };
}

/**
 * Build a description for a proxied tool that includes authorization context.
 */
export function buildProxiedToolDescription(
  tool: DiscoveredTool,
  state: SharedState,
): string {
  const lines = [tool.description];

  if (!tool.gating || !tool.gating.profile) {
    return tool.description;
  }

  const auths = state.getEnrichedAuthorizations();
  const matching = auths.filter(
    a => a.complete && profileMatches(a.profileId, tool.gating!.profile!),
  );
  const pending = auths.filter(
    a => !a.complete && profileMatches(a.profileId, tool.gating!.profile!),
  );

  if (matching.length > 0) {
    lines.push('Active authorizations:');
    for (const auth of matching) {
      const now = Math.floor(Date.now() / 1000);
      const earliestExpiry = Math.min(...auth.attestations.map(a => a.expiresAt));
      const remainingMin = Math.max(0, Math.round((earliestExpiry - now) / 60));
      const bounds = Object.entries(auth.frame)
        .filter(([key]) => key !== 'profile' && key !== 'path')
        .map(([key, value]) => `${key}: ${value}`)
        .join(', ');

      let desc = `  - ${auth.path}: ${bounds} (${remainingMin} min remaining)`;
      if (auth.gateContent) {
        desc += `\n    Purpose: ${auth.gateContent.objective}`;
      }
      lines.push(desc);
    }
  } else {
    lines.push(`No active authorizations for profile "${tool.gating.profile}".`);
  }

  for (const auth of pending) {
    const missing = auth.requiredDomains.filter(d => !auth.attestedDomains.includes(d));
    lines.push(`  - ${auth.path}: pending (needs ${missing.join(', ')})`);
  }

  return lines.join('\n');
}
