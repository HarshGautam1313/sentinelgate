/**
 * mockApi.js — mirrors SPEC.md API contracts exactly.
 *
 * To switch to real backend, uncomment the fetch() blocks
 * and delete the mock logic. Response shapes are identical —
 * no component changes needed.
 *
 * Real endpoints:
 *   createSession()                            POST /api/session
 *   previewRedaction({ sessionId, prompt })    POST /api/preview
 *   sendPrompt({ sessionId, prompt, aiModel }) POST /api/prompt
 *   getAuditLog(sessionId)                     GET  /api/audit/:sessionId
 */

const BASE_URL = 'http://localhost:5000';

// ─── Redaction engine (mirrors Python NER + regex pipeline) ──────────────────

const PATTERNS = [
  { re: /\b\d{4}\s?\d{4}\s?\d{4}\b/g,                                          type: 'AADHAAR'  },
  { re: /\b[A-Z]{5}[0-9]{4}[A-Z]\b/g,                                          type: 'PAN'      },
  { re: /\b(\+91[\-\s]?)?[6-9]\d{9}\b/g,                                       type: 'PHONE'    },
  { re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,                type: 'EMAIL'    },
  { re: /\bDr\.?\s+[A-Z][a-z]+\s+[A-Z][a-z]+\b/g,                             type: 'PERSON'   },
  { re: /\b(?:Mr\.|Ms\.|Mrs\.)\s*[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/g,          type: 'PERSON'   },
  { re: /\b[A-Z][a-z]+\s+(?:Hospital|Clinic|Labs|Institute|Corp|Ltd|Inc)\b/g,  type: 'ORG'      },
  { re: /\b(?:Mumbai|Delhi|Bangalore|Chennai|Hyderabad|Kolkata|Pune)\b/g,       type: 'LOCATION' },
  { re: /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b/g, type: 'DATE' },
  { re: /\b\d{1,2}\/\d{1,2}\/\d{4}\b/g,                                        type: 'DATE'     },
];

function runRedaction(text) {
  const valueToToken = {};
  const counters = {};
  const entities = [];
  let redacted = text;

  PATTERNS.forEach(({ re, type }) => {
    redacted = redacted.replace(re, (match) => {
      if (valueToToken[match]) return valueToToken[match];
      counters[type] = (counters[type] || 0) + 1;
      const token = `[${type}_${counters[type]}]`;
      valueToToken[match] = token;
      entities.push({ token, entityType: type, realValue: match });
      return token;
    });
  });

  return { redactedPrompt: redacted, entitiesRedacted: entities };
}

function buildMockAIResponse(entities) {
  const tokenList = entities.length
    ? entities.map((e) => e.token).join(', ')
    : 'none detected';

  let response =
    `Summary:\n\nThe submitted document has been reviewed. Based on the clinical ` +
    `details provided, a follow-up consultation is recommended within two weeks.\n\n` +
    `Sensitive identifiers processed: ${tokenList}. All redacted values have been ` +
    `restored in this response.\n\n` +
    `Note: This summary was generated from a fully redacted prompt. No personally ` +
    `identifiable information was transmitted to the AI model.`;

  // Re-inject real values
  entities.forEach((e) => {
    response = response.replace(
      new RegExp(e.token.replace(/[[\]]/g, '\\$&'), 'g'),
      e.realValue
    );
  });

  return response;
}

// ─── Exported API functions ───────────────────────────────────────────────────

export async function createSession() {
  // const res = await fetch(`${BASE_URL}/api/session`, { method: 'POST' });
  // return res.json();
  const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
  return { expiresAt };
}

export async function previewRedaction({ sessionId, prompt }) {
  // const res = await fetch(`${BASE_URL}/api/preview`, {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({ sessionId, prompt }),
  // });
  // return res.json();
  await new Promise((r) => setTimeout(r, 80));
  return runRedaction(prompt);
}

export async function sendPrompt({ sessionId, prompt, aiModel }) {
  // const res = await fetch(`${BASE_URL}/api/prompt`, {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({ sessionId, prompt, aiModel }),
  // });
  // return res.json();
  await new Promise((r) => setTimeout(r, 1200));
  const { redactedPrompt, entitiesRedacted } = runRedaction(prompt);
  const response = buildMockAIResponse(entitiesRedacted);
  return { response, redactedPrompt, entitiesRedacted };
}

export async function getAuditLog(sessionId) {
  // const res = await fetch(`${BASE_URL}/api/audit/${sessionId}`);
  // return res.json();
  await new Promise((r) => setTimeout(r, 200));
  return { logs: [] };
}
