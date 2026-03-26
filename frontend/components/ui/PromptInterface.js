'use client';

import { useState } from 'react';
import { useSession } from '../../lib/useSession';
import { previewRedaction, sendPrompt } from '../../lib/mockApi';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TYPE_TO_CLASS = {
  PHONE: 'token-PHONE', EMAIL: 'token-PHONE',
  AADHAAR: 'token-AADHAAR', PAN: 'token-AADHAAR',
  ORG: 'token-ORG', LOCATION: 'token-ORG',
};
function tokenClass(type) {
  return TYPE_TO_CLASS[type] || `token-${type}`;
}

const BADGE = {
  PERSON:   { bg: 'var(--red-bg)',    color: 'var(--red)'    },
  PHONE:    { bg: 'var(--orange-bg)', color: 'var(--orange)' },
  EMAIL:    { bg: 'var(--orange-bg)', color: 'var(--orange)' },
  AADHAAR:  { bg: 'var(--purple-bg)', color: 'var(--purple)' },
  PAN:      { bg: 'var(--purple-bg)', color: 'var(--purple)' },
  ORG:      { bg: 'var(--blue-bg)',   color: 'var(--blue)'   },
  LOCATION: { bg: 'var(--blue-bg)',   color: 'var(--blue)'   },
  DATE:     { bg: 'var(--green-bg)',  color: 'var(--green)'  },
  CUSTOM:   { bg: 'var(--amber-bg)',  color: 'var(--amber)'  },
};
function badge(type) {
  return BADGE[type] || BADGE.CUSTOM;
}

// ─── RedactionPanel ───────────────────────────────────────────────────────────

function RedactionPanel({ data, onSend }) {
  const { redactedPrompt, entitiesRedacted } = data;

  const highlighted = redactedPrompt.replace(
    /\[([A-Z]+)_(\d+)\]/g,
    (match, type) =>
      `<span class="token ${tokenClass(type)}">${match}</span>`
  );

  return (
    <div>
      <p style={css.sectionLabel}>Redacted prompt</p>
      <div
        style={css.codeBlock}
        dangerouslySetInnerHTML={{ __html: highlighted }}
      />

      <p style={{ ...css.sectionLabel, marginTop: '16px' }}>
        {entitiesRedacted.length}{' '}
        {entitiesRedacted.length === 1 ? 'entity' : 'entities'} redacted
      </p>

      {entitiesRedacted.length === 0 ? (
        <p style={{ color: 'var(--muted)', fontSize: '12px', marginBottom: '16px' }}>
          No sensitive entities detected.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
          {entitiesRedacted.map((e, i) => {
            const b = badge(e.entityType);
            return (
              <div key={i} style={css.entityRow}>
                <span style={{
                  ...css.typeBadge,
                  background: b.bg,
                  color: b.color,
                }}>
                  {e.entityType}
                </span>
                <span style={css.realValue}>{e.realValue}</span>
                <span style={css.arrow}>→</span>
                <span className={`token ${tokenClass(e.entityType)}`}>
                  {e.token}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <button
        style={css.sendPreviewBtn}
        onClick={onSend}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = 'var(--accent)';
          e.currentTarget.style.color = 'var(--accent)';
          e.currentTarget.style.background = 'var(--accent-dim)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = 'var(--border2)';
          e.currentTarget.style.color = 'var(--muted)';
          e.currentTarget.style.background = 'transparent';
        }}
      >
        Send redacted prompt to AI →
      </button>
    </div>
  );
}

// ─── ResponsePanel ────────────────────────────────────────────────────────────

function ResponsePanel({ data }) {
  return (
    <div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
        <span style={css.pillSuccess}>✓ Re-injected</span>
        <span style={css.pill}>{data.entitiesRedacted.length} entities restored</span>
      </div>
      <div style={css.codeBlock}>{data.response}</div>
    </div>
  );
}

// ─── EmptyState ───────────────────────────────────────────────────────────────

function EmptyState({ tab }) {
  return (
    <div style={css.emptyState}>
      <div style={css.emptyIcon}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M8 2L13 4.5V8C13 10.5 10.8 12.7 8 13.5C5.2 12.7 3 10.5 3 8V4.5L8 2Z"
            stroke="#3A404A" strokeWidth="1" />
        </svg>
      </div>
      <p style={css.emptyTitle}>
        {tab === 'redaction' ? 'No preview yet' : 'No response yet'}
      </p>
      <p style={css.emptySub}>
        {tab === 'redaction'
          ? 'Click Preview to see what gets redacted before sending'
          : 'Send a prompt to see the AI response here'}
      </p>
    </div>
  );
}

// ─── Spinner ──────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <>
      <span style={{
        width: '13px', height: '13px',
        border: '2px solid rgba(0,0,0,0.15)',
        borderTopColor: 'rgba(0,0,0,0.7)',
        borderRadius: '50%',
        display: 'inline-block',
        animation: 'spin 0.6s linear infinite',
      }} />
    </>
  );
}

// ─── PromptInterface ──────────────────────────────────────────────────────────

export default function PromptInterface() {
  const sessionId = useSession();
  const [prompt, setPrompt]         = useState('');
  const [model, setModel]           = useState('gpt-4o');
  const [tab, setTab]               = useState('redaction');
  const [previewData, setPreviewData] = useState(null);
  const [responseData, setResponseData] = useState(null);
  const [loading, setLoading]       = useState(false);

  const shortSession = sessionId ? sessionId.slice(0, 8) + '…' : '—';

  async function handlePreview() {
    if (!prompt.trim()) return;
    const data = await previewRedaction({ sessionId, prompt });
    setPreviewData(data);
    setTab('redaction');
  }

  async function handleSend() {
    if (!prompt.trim()) return;
    setLoading(true);
    try {
      const data = await sendPrompt({ sessionId, prompt, aiModel: model });
      setPreviewData({ redactedPrompt: data.redactedPrompt, entitiesRedacted: data.entitiesRedacted });
      setResponseData({ response: data.response, entitiesRedacted: data.entitiesRedacted });
      setTab('response');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={css.layout}>

      {/* ── Left pane ─────────────────────────────────────────────────────── */}
      <div style={css.leftPane}>

        <div style={css.paneHeader}>
          <span style={css.paneLabel}>Prompt</span>
          <span style={css.sessionTag}>SESSION {shortSession}</span>
        </div>

        <div style={css.promptArea}>
          <textarea
            style={css.textarea}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Enter your prompt. Sensitive data will be redacted before reaching the AI."
          />
        </div>

        <div style={css.promptFooter}>
          <select
            style={css.modelSelect}
            value={model}
            onChange={(e) => setModel(e.target.value)}
          >
            <option value="gpt-4o">GPT-4o</option>
            <option value="gpt-4o-mini">GPT-4o mini</option>
            <option value="gpt-3.5-turbo">GPT-3.5</option>
          </select>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              style={css.btnGhost}
              onClick={handlePreview}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'var(--surface2)';
                e.currentTarget.style.color = 'var(--text)';
                e.currentTarget.style.borderColor = 'var(--border)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'var(--muted)';
                e.currentTarget.style.borderColor = 'var(--border2)';
              }}
            >
              Preview
            </button>

            <button
              style={{ ...css.btnPrimary, ...(loading ? css.btnLoading : {}) }}
              onClick={handleSend}
              disabled={loading}
            >
              {loading ? <Spinner /> : 'Send'}
            </button>
          </div>
        </div>

      </div>

      {/* ── Right pane ────────────────────────────────────────────────────── */}
      <div style={css.rightPane}>

        <div style={css.tabs}>
          {['redaction', 'response'].map((t) => (
            <button
              key={t}
              style={{ ...css.tab, ...(tab === t ? css.tabActive : {}) }}
              onClick={() => setTab(t)}
            >
              {t.toUpperCase()}
            </button>
          ))}
        </div>

        <div style={css.panelBody}>
          {tab === 'redaction' && (
            previewData
              ? <RedactionPanel data={previewData} onSend={handleSend} />
              : <EmptyState tab="redaction" />
          )}
          {tab === 'response' && (
            responseData
              ? <ResponsePanel data={responseData} />
              : <EmptyState tab="response" />
          )}
        </div>

      </div>
    </div>
  );
}

// ─── Style objects ────────────────────────────────────────────────────────────

const css = {
  layout: {
    display: 'grid',
    gridTemplateColumns: '1fr 380px',
    height: 'calc(100vh - 52px)',
  },
  leftPane: {
    display: 'flex', flexDirection: 'column',
    borderRight: '1px solid var(--border)',
    overflow: 'hidden',
  },
  paneHeader: {
    padding: '16px 20px 12px',
    borderBottom: '1px solid var(--border)',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    flexShrink: 0,
  },
  paneLabel: {
    fontFamily: 'var(--font-mono)', fontSize: '10px',
    color: 'var(--muted)', letterSpacing: '0.08em', textTransform: 'uppercase',
  },
  sessionTag: {
    fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--muted)',
    background: 'var(--surface2)', border: '1px solid var(--border2)',
    padding: '2px 8px', borderRadius: '4px',
  },
  promptArea: {
    flex: 1, display: 'flex', flexDirection: 'column',
    padding: '16px 20px', overflow: 'hidden',
  },
  textarea: {
    flex: 1, background: 'transparent', border: 'none', outline: 'none',
    color: 'var(--text)', fontFamily: 'var(--font-sans)',
    fontSize: '14px', lineHeight: 1.7, resize: 'none',
    caretColor: 'var(--accent)',
  },
  promptFooter: {
    padding: '12px 20px',
    borderTop: '1px solid var(--border)',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    flexShrink: 0, gap: '12px',
  },
  modelSelect: {
    fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--muted)',
    background: 'var(--surface2)', border: '1px solid var(--border2)',
    borderRadius: '6px', padding: '5px 10px',
    cursor: 'pointer', outline: 'none', appearance: 'none',
  },
  btnGhost: {
    fontFamily: 'var(--font-sans)', fontSize: '13px', fontWeight: 500,
    borderRadius: '7px', padding: '6px 14px', cursor: 'pointer',
    background: 'transparent', border: '1px solid var(--border2)',
    color: 'var(--muted)', transition: 'all 0.15s',
  },
  btnPrimary: {
    fontFamily: 'var(--font-sans)', fontSize: '13px', fontWeight: 500,
    borderRadius: '7px', padding: '6px 20px', cursor: 'pointer',
    background: 'var(--accent)', border: '1px solid var(--accent)',
    color: '#000', transition: 'all 0.15s',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    minWidth: '64px', gap: '6px',
  },
  btnLoading: {
    background: 'var(--surface2)', borderColor: 'var(--border2)',
    color: 'var(--muted)', cursor: 'not-allowed',
  },
  rightPane: {
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
  },
  tabs: {
    display: 'flex', borderBottom: '1px solid var(--border)', flexShrink: 0,
  },
  tab: {
    flex: 1, fontFamily: 'var(--font-mono)', fontSize: '11px',
    letterSpacing: '0.04em', color: 'var(--muted)',
    padding: '12px 0', textAlign: 'center', cursor: 'pointer',
    border: 'none', borderBottom: '2px solid transparent',
    background: 'transparent', transition: 'color 0.15s, border-color 0.15s',
  },
  tabActive: {
    color: 'var(--accent)', borderBottomColor: 'var(--accent)',
  },
  panelBody: {
    flex: 1, overflowY: 'auto', padding: '16px 20px',
  },
  emptyState: {
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    height: '100%', gap: '8px', padding: '40px 0',
  },
  emptyIcon: {
    width: '32px', height: '32px',
    border: '1px solid var(--border2)', borderRadius: '8px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    marginBottom: '4px',
  },
  emptyTitle: { fontSize: '13px', color: 'var(--muted)', textAlign: 'center' },
  emptySub: {
    fontSize: '12px', color: '#3A404A',
    textAlign: 'center', maxWidth: '200px', lineHeight: 1.5,
  },
  sectionLabel: {
    fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--muted)',
    letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '8px',
  },
  codeBlock: {
    fontFamily: 'var(--font-mono)', fontSize: '12px', lineHeight: 1.8,
    color: 'var(--text)', background: 'var(--surface)',
    border: '1px solid var(--border)', borderRadius: '8px',
    padding: '14px', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
  },
  entityRow: {
    display: 'flex', alignItems: 'center', gap: '8px',
    padding: '8px 12px', background: 'var(--surface)',
    border: '1px solid var(--border)', borderRadius: '7px',
  },
  typeBadge: {
    fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 500,
    padding: '2px 7px', borderRadius: '4px', flexShrink: 0,
  },
  realValue: {
    fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--muted)',
    maxWidth: '130px', overflow: 'hidden',
    textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  arrow: { color: 'var(--border2)', fontSize: '11px' },
  sendPreviewBtn: {
    width: '100%', marginTop: '8px', padding: '9px',
    background: 'transparent', border: '1px dashed var(--border2)',
    borderRadius: '7px', color: 'var(--muted)',
    fontSize: '12px', fontFamily: 'var(--font-sans)',
    cursor: 'pointer', transition: 'all 0.15s',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  pill: {
    fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--muted)',
    background: 'var(--surface2)', border: '1px solid var(--border2)',
    padding: '2px 8px', borderRadius: '4px',
  },
  pillSuccess: {
    fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--green)',
    background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)',
    padding: '2px 8px', borderRadius: '4px',
  },
};
