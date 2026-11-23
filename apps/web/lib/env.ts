const publicSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? '';
const publicSupabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? '';

export function getSupabasePublicConfig(): { url: string; anonKey: string } {
  if (!publicSupabaseUrl || !publicSupabaseAnonKey) {
    throw new Error(
      'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.',
    );
  }
  return { url: publicSupabaseUrl, anonKey: publicSupabaseAnonKey };
}

export function isSupabaseConfigured(): boolean {
  return Boolean(publicSupabaseUrl && publicSupabaseAnonKey);
}

export function appBaseUrl(): string {
  const configured = process.env.APP_BASE_URL?.trim();
  if (configured) {
    try {
      return new URL(configured).origin;
    } catch {
      return configured.replace(/\/$/, '');
    }
  }
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) {
    return `https://${vercel}`;
  }
  return 'http://127.0.0.1:3000';
}

export function requireServerEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required server environment variable ${name}.`);
  }
  return value;
}
