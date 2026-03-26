require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const { spawn } = require('child_process');
const axios = require('axios');
const { encrypt, decrypt } = require('./vault/vault');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// ── MongoDB Schemas ──────────────────────────────────────────────────────────

const vaultSchema = new mongoose.Schema({
  sessionId:  String,
  token:      String,
  entityType: String,
  realValue:  String, // AES-256 encrypted
  createdAt:  { type: Date, default: Date.now },
  expiresAt:  Date,
});
vaultSchema.index({ sessionId: 1, token: 1 });
vaultSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
const VaultEntry = mongoose.model('VaultEntry', vaultSchema);

const auditSchema = new mongoose.Schema({
  sessionId:          String,
  timestamp:          { type: Date, default: Date.now },
  originalPromptHash: String,
  redactedPrompt:     String,
  entitiesRedacted:   Array,
  aiModel:            String,
  responseReceived:   Boolean,
});
const AuditLog = mongoose.model('AuditLog', auditSchema);

// ── NER helper ───────────────────────────────────────────────────────────────

function callNER(text, sessionId, retries = 1) {
  return new Promise((resolve, reject) => {
    const isWindows = process.platform === 'win32';
    const py = spawn(isWindows ? 'python' : 'python3', ['ner/redactor.py']);
    let output = '';
    let errOutput = '';
    let settled = false;

    // Timeout — kill the process if it takes more than 15 seconds
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      py.kill();
      if (retries > 0) {
        console.warn('NER timeout — retrying once...');
        callNER(text, sessionId, retries - 1).then(resolve).catch(reject);
      } else {
        reject(new Error('NER process timed out'));
      }
    }, 15000);

    py.stdin.write(JSON.stringify({ text, sessionId }));
    py.stdin.end();

    py.stdout.on('data', d => output += d);
    py.stderr.on('data', d => errOutput += d);

    py.on('close', code => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code !== 0) {
        if (retries > 0) {
          console.warn(`NER exited ${code} — retrying once...`);
          return callNER(text, sessionId, retries - 1).then(resolve).catch(reject);
        }
        return reject(new Error(`NER exited ${code}: ${errOutput}`));
      }
      try { resolve(JSON.parse(output)); }
      catch (e) { reject(new Error(`NER JSON parse failed: ${output}`)); }
    });

    py.on('error', err => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new Error(`NER spawn failed: ${err.message}`));
    });
  });
}

// ── Re-injection ─────────────────────────────────────────────────────────────

function reinject(aiResponse, vaultMap) {
  return aiResponse.replace(/\[([A-Z]+)_(\d+)\]/g, (match) => {
    return vaultMap[match] !== undefined ? vaultMap[match] : match;
  });
}

// ── Vault write helper ───────────────────────────────────────────────────────

async function writeVaultEntries(sessionId, entities) {
  const ttlHours = parseInt(process.env.SESSION_TTL_HOURS || '2');
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);

  for (const entity of entities) {
    const existing = await VaultEntry.findOne({ sessionId, token: entity.token });
    if (!existing) {
      await VaultEntry.create({
        sessionId,
        token:      entity.token,
        entityType: entity.entityType,
        realValue:  encrypt(entity.realValue),
        expiresAt,
      });
    }
  }
}


// ── Sanitize function ───────────────────────────────────────────────────────────────────
function sanitize(input) {
  if (typeof input !== 'string') return '';
  return input
    .slice(0, 4000)                          // max prompt length
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '') // strip control characters
    .replace(/\[([A-Z]+)_(\d+)\]/g, '')      // strip pre-existing tokens (prompt injection)
    .trim();
}

// ── Routes ───────────────────────────────────────────────────────────────────

// POST /api/session
app.post('/api/session', (req, res) => {
  const sessionId = uuidv4();
  const ttlHours = parseInt(process.env.SESSION_TTL_HOURS || '2');
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);
  res.json({ sessionId, expiresAt });
});

// POST /api/preview
app.post('/api/preview', async (req, res) => {
  const { sessionId, prompt: rawPrompt } = req.body;
  if (!sessionId || !rawPrompt)
    return res.status(400).json({ error: 'sessionId and prompt required' });
  const prompt = sanitize(rawPrompt);
  if (!prompt)
    return res.status(400).json({ error: 'prompt is empty after sanitization' });

  try {
    const nerResult = await callNER(prompt, sessionId);
    res.json({
      redactedPrompt:   nerResult.redactedText,
      entitiesRedacted: nerResult.entities.map(e => ({
        token:      e.token,
        entityType: e.entityType,
        realValue:  e.realValue,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/prompt
app.post('/api/prompt', async (req, res) => {

  const { sessionId, prompt: rawPrompt, aiModel = 'gemini-1.5-flash' } = req.body;
if (!sessionId || !rawPrompt)
  return res.status(400).json({ error: 'sessionId and prompt required' });
const prompt = sanitize(rawPrompt);
if (!prompt)
  return res.status(400).json({ error: 'prompt is empty after sanitization' });

  try {
    // 1. Redact
    const nerResult = await callNER(prompt, sessionId);
    const { redactedText, entities } = nerResult;

    // 2. Write vault
    await writeVaultEntries(sessionId, entities);

    // 3. Audit log (no raw prompt — only hash)
    const promptHash = crypto.createHash('sha256').update(prompt).digest('hex');
    const auditEntry = await AuditLog.create({
      sessionId,
      originalPromptHash: promptHash,
      redactedPrompt:     redactedText,
      entitiesRedacted:   entities.map(e => ({ token: e.token, entityType: e.entityType })),
      aiModel,
      responseReceived:   false,
    });

    // 4. Call GROQ
    const GROQ_MODELS = ['llama-3.1-8b-instant', 'llama-3.3-70b-versatile', 'llama3-8b-8192'];
    const resolvedModel = GROQ_MODELS.includes(aiModel) ? aiModel : process.env.GROQ_MODEL;
    const groqRes = await axios.post(
      process.env.GROQ_API_URL,
      {
        model: resolvedModel,
        messages: [
          {
            role: "system",
            content: "You are a helpful assistant. The user's message may contain placeholder tokens like [PERSON_1], [PHONE_1], [AADHAAR_1] etc. Treat these as stand-ins for real values and complete the requested task as if they were real. Never ask for the actual values behind the placeholders."
          },
          {
            role: "user",
            content: redactedText
          }
        ]
      },
      {
        headers: {
          "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );
const aiResponse = groqRes.data.choices[0].message.content;

    // 5. Update audit log
    await AuditLog.findByIdAndUpdate(auditEntry._id, { responseReceived: true });

    // 6. Build vault map for re-injection
    const vaultEntries = await VaultEntry.find({ sessionId });
    const vaultMap = {};
    for (const entry of vaultEntries) {
      vaultMap[entry.token] = decrypt(entry.realValue);
    }

    // 7. Re-inject
    const finalResponse = reinject(aiResponse, vaultMap);

    res.json({
      response:         finalResponse,
      redactedPrompt:   redactedText,
      entitiesRedacted: entities.map(e => ({ token: e.token, entityType: e.entityType })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/audit/:sessionId
app.get('/api/audit/:sessionId', async (req, res) => {
  try {
    const logs = await AuditLog.find(
      { sessionId: req.params.sessionId },
      { _id: 0, __v: 0 }
    ).sort({ timestamp: -1 });
    res.json({ logs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Start ────────────────────────────────────────────────────────────────────

mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('MongoDB connected');
    app.listen(process.env.PORT, () =>
      console.log(`SentinelGate running on port ${process.env.PORT}`)
    );
  })
  .catch(err => { console.error('MongoDB connection failed:', err); process.exit(1); });