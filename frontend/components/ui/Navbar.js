'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Navbar() {
  const pathname = usePathname();

  const linkStyle = (href) => ({
    fontSize: '13px',
    color: pathname === href ? 'var(--text)' : 'var(--muted)',
    background: pathname === href ? 'var(--surface2)' : 'transparent',
    padding: '4px 10px',
    borderRadius: '6px',
    textDecoration: 'none',
    transition: 'color 0.15s, background 0.15s',
  });

  return (
    <nav style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 24px',
      height: '52px',
      borderBottom: '1px solid var(--border)',
      background: 'var(--bg)',
      position: 'sticky',
      top: 0,
      zIndex: 10,
    }}>

      {/* Logo */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        fontFamily: 'var(--font-mono)', fontSize: '13px',
        fontWeight: 500, letterSpacing: '0.04em', color: 'var(--text)',
      }}>
        <div style={{
          width: '18px', height: '18px',
          border: '1.5px solid var(--accent)', borderRadius: '4px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M5 1L9 3V6C9 7.7 7.2 9 5 9C2.8 9 1 7.7 1 6V3L5 1Z"
              stroke="#00C9FF" strokeWidth="1" fill="none" />
          </svg>
        </div>
        SENTINELGATE
      </div>

      {/* Nav links */}
      <div style={{ display: 'flex', gap: '4px' }}>
        <Link href="/"      style={linkStyle('/')}>Prompt</Link>
        <Link href="/audit" style={linkStyle('/audit')}>Audit Log</Link>
      </div>

      {/* Status pill */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '6px',
        fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--accent)',
        padding: '4px 10px',
        border: '1px solid rgba(0, 201, 255, 0.2)',
        borderRadius: '20px',
        background: 'var(--accent-dim)',
      }}>
        <span style={{
          width: '6px', height: '6px', borderRadius: '50%',
          background: 'var(--accent)',
          animation: 'pulse 2s ease-in-out infinite',
          flexShrink: 0,
        }} />
        SECURE
      </div>

    </nav>
  );
}
