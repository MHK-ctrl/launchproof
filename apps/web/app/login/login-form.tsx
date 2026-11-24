'use client';

import { Github } from 'lucide-react';
import { useState } from 'react';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';

export function LoginForm({ next }: { next: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    setLoading(true);
    setError(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: { redirectTo },
      });
      if (authError) {
        setError(authError.message);
        setLoading(false);
      }
    } catch {
      setError('GitHub sign-in is unavailable. Check the cloud configuration.');
      setLoading(false);
    }
  }

  return (
    <div className="mt-6">
      <button type="button" className="btn btn-primary w-full" onClick={signIn} disabled={loading}>
        <Github size={17} aria-hidden="true" />
        {loading ? 'Redirecting to GitHub…' : 'Continue with GitHub'}
      </button>
      {error ? (
        <p role="alert" className="mt-3 text-xs text-[var(--red)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
