export default function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  const url = process.env.SUPABASE_URL || '';
  const anonKey = process.env.SUPABASE_ANON_KEY || '';
  response.status(url && anonKey ? 200 : 503).json({
    configured: Boolean(url && anonKey),
    supabaseUrl: url,
    supabaseAnonKey: anonKey,
    version: '1.0.0'
  });
}
