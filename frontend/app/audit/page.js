'use client';

export default function AuditPage() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: 'calc(100vh - 52px)',
      gap: '10px',
    }}>
      <div style={{
        width: '32px', height: '32px',
        border: '1px solid var(--border2)',
        borderRadius: '8px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <rect x="2" y="3"  width="12" height="1.5" rx="0.75" fill="#3A404A"/>
          <rect x="2" y="7"  width="9"  height="1.5" rx="0.75" fill="#3A404A"/>
          <rect x="2" y="11" width="11" height="1.5" rx="0.75" fill="#3A404A"/>
        </svg>
      </div>
      <p style={{ fontSize: '13px', color: 'var(--muted)' }}>Audit Log</p>
      <p style={{ fontSize: '12px', color: '#3A404A', maxWidth: '200px', textAlign: 'center', lineHeight: 1.5 }}>
        Session history will appear here once the backend is connected.
      </p>
    </div>
  );
}
