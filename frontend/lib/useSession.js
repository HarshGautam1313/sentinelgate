'use client';

import { useState, useEffect } from 'react';

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// UUID is generated inside useEffect (client-only).
// Server renders '', client hydrates with '', then effect fires — no mismatch.
export function useSession() {
  const [sessionId, setSessionId] = useState('');

  useEffect(() => {
    setSessionId(generateUUID());
  }, []);

  return sessionId;
}
