/**
 * Gate Content Hash Verification — ensures plaintext gate content matches attestation hashes.
 *
 * v0.4: single `intent` hash.
 * v0.3 compat: `problem`, `objective`, `tradeoffs` hashes.
 */

import { createHash } from 'node:crypto';
import { decodeAttestationBlob } from '@hap/core';
import type { GateContent } from './gate-store';
import type { CachedAuthorization } from './attestation-cache';

/**
 * Hash a gate content string using SHA-256.
 * Returns format: sha256:<hex>
 */
export function hashGateContent(text: string): string {
  const hex = createHash('sha256').update(text, 'utf-8').digest('hex');
  return `sha256:${hex}`;
}

/**
 * Verify that gate content plaintext matches the hashes in the attestation.
 * Supports both v0.4 (intent) and v0.3 (problem/objective/tradeoffs).
 */
export function verifyGateContentHashes(
  content: GateContent,
  auth: CachedAuthorization
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (auth.attestations.length === 0) {
    return { valid: false, errors: ['No attestations available to verify against'] };
  }

  const attestation = decodeAttestationBlob(auth.attestations[0].blob);
  const expectedHashes = attestation.payload.gate_content_hashes;

  if (!expectedHashes) {
    return { valid: false, errors: ['Attestation does not contain gate_content_hashes'] };
  }

  // v0.4: single intent hash
  if (expectedHashes.intent && content.intent) {
    const actual = hashGateContent(content.intent);
    if (actual !== expectedHashes.intent) {
      errors.push(`Hash mismatch for "intent": expected ${expectedHashes.intent}, got ${actual}`);
    }
    return { valid: errors.length === 0, errors };
  }

  // v0.3 compat: three separate hashes
  for (const field of ['problem', 'objective', 'tradeoffs'] as const) {
    const expected = expectedHashes[field];
    if (!expected) continue;

    const value = content[field];
    if (!value) {
      errors.push(`Missing content for "${field}"`);
      continue;
    }

    const actual = hashGateContent(value);
    if (actual !== expected) {
      errors.push(`Hash mismatch for "${field}": expected ${expected}, got ${actual}`);
    }
  }

  return { valid: errors.length === 0, errors };
}
