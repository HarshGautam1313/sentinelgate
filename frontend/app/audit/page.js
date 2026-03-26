'use client';

import { useState, useEffect } from 'react';
import { useSession } from '../../lib/useSession';
import { getAuditLog } from '../../lib/mockApi';

const BADGE = {
  PERSON:   { bg: 'rgba(239,68,68,0.1)',   color: '#ef4444' },
  PHONE:    { bg: 'rgba(249,115,22,0.1)',  color: '#f97316' },
  EMAIL:    { bg: 'rgba(249,115,22,0.1)',  color: '#f97316' },
  AADHAAR:  { bg: 'rgba(168,85,247,0.1)',  color: '#a855f7' },
  PAN:      { bg: 'rgba(168,85,247,0.1)',  color: '#a855f7' },
  ORG:      { bg: 'rgba(59,130,246,0.1)',  color: '#3b82f6' },
  LOCATION: { bg: 'rgba(59,130,246,0.1)',  color: '#3b82f6' },
  DATE:     { bg: 'rgba(34,197,94,0.1)',   color: '#22c55e' },
  CUSTOM:   { bg: 'rgba(245,158,11,0.1)',  color: '#f59e0b' },
};
function badge(type) { return BADGE[type] || BADGE.CUSTOM; }

function formatTime(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function AuditPage() {
  const sessionId = useSession();
  const [logs, setLogs]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => {
    if (!sessionId) return;
    setLoading(true);
    getAuditLog(sessionId)
      .then((data) => { setLogs(data.logs || []); setLoading(false); })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, [sessionId]);

  if (loading) return <Center><p style={css.muted}>Loading audit log…</p></Center>;
  if (error)   return <Center><p style={{ ...css.muted, color: '#ef4444' }}>Error: {error}</p></Center>;

  if (logs.length === 0) return (
    <Center>
      <div style={css.emptyIcon}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <rect x="2" y="3"  width="12" height="1.5" rx="0.75" fill="#3A404A"/>
          <rect x="2" y="7"  width="9"  height="1.5" rx="0.75" fill="#3A404A"/>
          <rect x="2" y="11" width="11" height="1.5" rx="0.75" fill="#3A404A"/>
        </svg>
      </div>
      <p style={css.emptyTitle}>Audit Log</p>
      <p style={css.emptySub}>No prompts sent in this session yet.</p>
    </Center>
  );

  return (
    <div style={css.page}>
      <div style={css.header}>
        <span style={css.label}>AUDIT LOG</span>
        <span style={css.sessionTag}>SESSION {sessionId.slice(0, 8)}…</span>
      </div>

      <div style={css.list}>
        {logs.map((log, i) => (
          <div key={i} style={css.card}>

            {/* Top row: timestamp + model + status */}
            <div style={css.cardHeader}>
              <span style={css.timestamp}>{formatTime(log.timestamp)}</span>
              <span style={css.pill}>{log.aiModel}</span>
              {log.responseReceived && (
                <span style={css.pillSuccess}>✓ Response received</span>
              )}
            </div>

            {/* Redacted prompt */}
            <p style={css.sectionLabel}>Redacted prompt</p>
            <div style={css.codeBlock}>{log.redactedPrompt}</div>

            {/* Entities */}
            {log.entitiesRedacted?.length > 0 && (
              <>
                <p style={{ ...css.sectionLabel, marginTop: '12px' }}>
                  {log.entitiesRedacted.length} {log.entitiesRedacted.length === 1 ? 'entity' : 'entities'} redacted
                </p>
                <div style={css.entityList}>
                  {log.entitiesRedacted.map((e, j) => {
                    const b = badge(e.entityType);
                    return (
                      <span key={j} style={{ ...css.entityBadge, background: b.bg, color: b.color }}>
                        {e.entityType}: {e.token}
                      </span>
                    );
                  })}
                </div>
              </>
            )}

          </div>
        ))}
      </div>
    </div>
  );
}

function Center({ children }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      height: 'calc(100vh - 52px)', gap: '10px',
    }}>
      {children}
    </div>
  );
}

const css = {
  page: { maxWidth: '720px', margin: '0 auto', padding: '32px 24px' },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: '24px',
  },
  label: {
    fontFamily: 'var(--font-mono)', fontSize: '10px',
    color: 'var(--muted)', letterSpacing: '0.08em',
  },
  sessionTag: {
    fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--muted)',
    background: 'var(--surface2)', border: '1px solid var(--border2)',
    padding: '2px 8px', borderRadius: '4px',
  },
  list:  { display: 'flex', flexDirection: 'column', gap: '16px' },
  card:  {
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: '10px', padding: '16px 20px',
  },
  cardHeader: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' },
  timestamp: { fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--muted)' },
  pill: {
    fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--muted)',
    background: 'var(--surface2)', border: '1px solid var(--border2)',
    padding: '2px 8px', borderRadius: '4px',
  },
  pillSuccess: {
    fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#22c55e',
    background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)',
    padding: '2px 8px', borderRadius: '4px',
  },
  sectionLabel: {
    fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--muted)',
    letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '6px',
  },
  codeBlock: {
    fontFamily: 'var(--font-mono)', fontSize: '12px', lineHeight: 1.8,
    color: 'var(--text)', background: 'var(--surface2)',
    border: '1px solid var(--border)', borderRadius: '8px',
    padding: '12px 14px', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
  },
  entityList: { display: 'flex', flexWrap: 'wrap', gap: '6px' },
  entityBadge: {
    fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 500,
    padding: '3px 8px', borderRadius: '4px',
  },
  muted: { fontSize: '13px', color: 'var(--muted)' },
  emptyIcon: {
    width: '32px', height: '32px', border: '1px solid var(--border2)',
    borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  emptyTitle: { fontSize: '13px', color: 'var(--muted)' },
  emptySub: { fontSize: '12px', color: '#3A404A', maxWidth: '200px', textAlign: 'center', lineHeight: 1.5 },
};