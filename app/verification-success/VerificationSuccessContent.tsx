'use client';

import { useEffect, useState } from 'react';

export default function VerificationSuccessContent({ path = '' }: { path?: string }) {
  const [info, setInfo] = useState<Record<string, any> | null>(null);

  useEffect(() => {
    // Try to read stored session id from localStorage as a fallback
    try {
      const sid = localStorage.getItem('didit_session_id');
      if (sid) setInfo({ session_id: sid });
    } catch {}
  }, []);

  return (
    <div className="max-w-2xl mx-auto my-20 p-6 bg-green-100 border border-green-300 rounded-lg text-center">
      <h1 className="text-3xl font-bold mb-4 text-green-800">Verification Successful!</h1>
      <p className="text-lg text-green-700">Your verification finished and you were redirected successfully.</p>

      {path && (
        <div className="mt-4 text-sm text-left bg-white p-3 rounded shadow">
          <strong>Callback path:</strong>
    <div className="break-all text-xs text-gray-700">{path}</div>
        </div>
      )}

      {info && (
        <div className="mt-4 text-sm text-left bg-white p-3 rounded shadow">
          <strong>Saved session info:</strong>
          <pre className="text-xs">{JSON.stringify(info, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
