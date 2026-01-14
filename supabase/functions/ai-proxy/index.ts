import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-supabase-auth',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function ensureEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function assertAuthenticated(req: Request) {
  const supabaseUrl = ensureEnv('SUPABASE_URL');
  const supabaseAnonKey = ensureEnv('SUPABASE_ANON_KEY');
  const authHeader = req.headers.get('x-supabase-auth');
  console.log('ai-proxy header check', authHeader ?? '<missing>');

  if (!authHeader) {
    return { ok: false as const, response: new Response('Missing authentication', { status: 401, headers: corsHeaders }) };
  }

  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
      method: 'GET',
      headers: {
        Authorization: authHeader,
        apikey: supabaseAnonKey,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to verify Supabase session', response.status, errorText);
      return { ok: false as const, response: new Response('Failed to verify session', { status: 401, headers: corsHeaders }) };
    }

    const user = await response.json();
    if (!user?.id) {
      return { ok: false as const, response: new Response('Unauthenticated', { status: 401, headers: corsHeaders }) };
    }
  } catch (error) {
    console.error('Error verifying Supabase session', error);
    return { ok: false as const, response: new Response('Failed to verify session', { status: 401, headers: corsHeaders }) };
  }

  return { ok: true as const };
}

function buildOpenAiUrl(req: Request): URL | null {
  const url = new URL(req.url);
  const pathname = url.pathname;

  const functionPrefixMatch = pathname.match(/^\/([^/]+)/);
  if (!functionPrefixMatch) {
    return null;
  }

  const functionPrefix = functionPrefixMatch[0];
  let forwardedPath = pathname.slice(functionPrefix.length);
  if (forwardedPath.startsWith('/')) {
    forwardedPath = forwardedPath.slice(1);
  }

  if (!forwardedPath) {
    return null;
  }

  const targetUrl = new URL(`https://api.openai.com/v1/${forwardedPath}`);
  targetUrl.search = url.search;
  return targetUrl;
}

function createForwardHeaders(req: Request, openAiKey: string): Headers {
  const headers = new Headers();

  for (const [key, value] of req.headers.entries()) {
    const normalized = key.toLowerCase();
    if (normalized === 'authorization' || normalized === 'x-supabase-auth' || normalized === 'host' || normalized === 'content-length') {
      continue;
    }
    headers.set(key, value);
  }

  headers.set('Authorization', `Bearer ${openAiKey}`);
  if (!headers.has('content-type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (!headers.has('accept')) {
    headers.set('Accept', 'text/event-stream');
  }

  return headers;
}

function applyCorsHeaders(headers: Headers): Headers {
  const result = new Headers(headers);
  result.set('Access-Control-Allow-Origin', corsHeaders['Access-Control-Allow-Origin']);
  result.set('Access-Control-Allow-Headers', corsHeaders['Access-Control-Allow-Headers']);
  result.set('Access-Control-Allow-Methods', corsHeaders['Access-Control-Allow-Methods']);
  result.set('Cache-Control', 'no-store');
  return result;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authResult = await assertAuthenticated(req);
    if (!authResult.ok) {
      return authResult.response;
    }

    const targetUrl = buildOpenAiUrl(req);
    if (!targetUrl) {
      return new Response('Invalid path', { status: 404, headers: corsHeaders });
    }

    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: corsHeaders });
    }

    if (!targetUrl.pathname.endsWith('/responses')) {
      return new Response('Unsupported endpoint', { status: 404, headers: corsHeaders });
    }

    const openAiKey = ensureEnv('OPENAI_API_KEY');
    const forwardHeaders = createForwardHeaders(req, openAiKey);

    const openAiResponse = await fetch(targetUrl, {
      method: 'POST',
      headers: forwardHeaders,
      body: req.body,
    });

    const responseHeaders = applyCorsHeaders(openAiResponse.headers);

    return new Response(openAiResponse.body, {
      status: openAiResponse.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error('ai-proxy error', error);
    return new Response('Internal server error', { status: 500, headers: corsHeaders });
  }
});
