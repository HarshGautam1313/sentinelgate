'use client';

import { useState, useEffect } from 'react';

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Persists sessionId in sessionStorage so it survives page navigation
// within the same browser tab. A new tab = new session (correct behaviour).
export function useSession() {
  const [sessionId, setSessionId] = useState('');

  useEffect(() => {
    let id = sessionStorage.getItem('sg_session_id');
    if (!id) {
      id = generateUUID();
      sessionStorage.setItem('sg_session_id', id);
    }
    setSessionId(id);
  }, []);

  return sessionId;
}