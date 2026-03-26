/**
 * mockApi.js — wired to real backend (localhost:5000)
 *
 * All mock logic removed. Response shapes are identical to SPEC.md.
 *
 * Real endpoints:
 *   createSession()                            POST /api/session
 *   previewRedaction({ sessionId, prompt })    POST /api/preview
 *   sendPrompt({ sessionId, prompt, aiModel }) POST /api/prompt
 *   getAuditLog(sessionId)                     GET  /api/audit/:sessionId
 */

const BASE_URL = 'http://localhost:5000';

// ─── Exported API functions ───────────────────────────────────────────────────

export async function createSession() {
  const res = await fetch(`${BASE_URL}/api/session`, { method: 'POST' });
  if (!res.ok) throw new Error(`createSession failed: ${res.status}`);
  return res.json();
}

export async function previewRedaction({ sessionId, prompt }) {
  const res = await fetch(`${BASE_URL}/api/preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, prompt }),
  });
  if (!res.ok) throw new Error(`previewRedaction failed: ${res.status}`);
  return res.json();
}

export async function sendPrompt({ sessionId, prompt, aiModel }) {
  const res = await fetch(`${BASE_URL}/api/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, prompt, aiModel }),
  });
  if (!res.ok) throw new Error(`sendPrompt failed: ${res.status}`);
  return res.json();
}

export async function getAuditLog(sessionId) {
  const res = await fetch(`${BASE_URL}/api/audit/${sessionId}`);
  if (!res.ok) throw new Error(`getAuditLog failed: ${res.status}`);
  return res.json();
}