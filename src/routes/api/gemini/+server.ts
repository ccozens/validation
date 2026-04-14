import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';

const GEMINI_API_URL = 
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent';
  

function getApiKey(): string {
  const key = (env.GEMINI_API_KEY ?? env.VITE_GEMINI_API_KEY ?? '').trim();
  if (!key) {
    error(
      500,
      'Gemini API key not configured. Add GEMINI_API_KEY (recommended) or VITE_GEMINI_API_KEY to .env and restart the dev server.'
    );
  }
  return key;
}

export const POST: RequestHandler = async ({ request }) => {
  const apiKey = getApiKey();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    error(400, 'Invalid JSON body');
  }

  const prompt =
    typeof body === 'object' && body !== null && 'prompt' in body
      ? String((body as { prompt: unknown }).prompt)
      : '';

  if (!prompt.trim()) {
    error(400, 'Missing prompt');
  }

  const res = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 600,
      },
    }),
  });

  const raw = await res.text();
  if (!res.ok) {
    let message = raw;
    try {
      const parsed = JSON.parse(raw) as { error?: { message?: string } };
      if (parsed.error?.message) message = parsed.error.message;
    } catch {
      /* keep raw */
    }
    error(res.status, message.length > 400 ? `${message.slice(0, 400)}…` : message);
  }

  let data: { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  try {
    data = JSON.parse(raw);
  } catch {
    error(502, 'Invalid response from Gemini');
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? 'No response generated.';
  return json({ text });
};
