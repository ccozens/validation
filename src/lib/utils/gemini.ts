// src/lib/utils/gemini.ts
// Calls Gemini via /api/gemini so the key stays on the server and browser CORS does not apply.

async function callGemini(prompt: string): Promise<string> {
  const res = await fetch('/api/gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });

  const errBody = await res.text();
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const parsed = JSON.parse(errBody) as { message?: string };
      if (typeof parsed.message === 'string') message = parsed.message;
    } catch {
      if (errBody) message = errBody.slice(0, 500);
    }
    throw new Error(message);
  }

  const data = JSON.parse(errBody) as { text?: string };
  return data.text ?? 'No response generated.';
}

export async function generateDaySummary(
  dateStr: string,
  entries: string[]
): Promise<string> {
  const formattedDate = new Date(dateStr + 'T12:00:00').toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const entriesText = entries
    .map((e, i) => `- ${e}`)
    .join('\n');

  const prompt = `You are a warm, calm journal assistant for a stay-at-home parent running a busy neurodivergent household with two young children (ages around 3 and 5). Your role is to witness and validate — not to advise or reframe.

Today is ${formattedDate}. Here are the things logged throughout the day:

${entriesText}

Write a brief end-of-day reflection (3–5 sentences). Lead with what was actually done — name the specific tasks, especially invisible labour like sourcing specific foods, managing routines, arranging activities, and household admin. Close with a single warm sentence that acknowledges how full the day was. 

Tone: warm, calm, like a thoughtful friend who genuinely gets it. Do NOT suggest improvements, add encouragement platitudes, or say things like "remember to look after yourself". Just witness and validate.`;

  return callGemini(prompt);
}

export async function generateWeekSummary(
  sinceDate: string | null,
  untilDate: string,
  entriesByDay: { date: string; entries: string[] }[]
): Promise<string> {
  const fmtDate = (s: string) =>
    new Date(s + 'T12:00:00').toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });

  const periodLabel = sinceDate
    ? `${fmtDate(sinceDate)} to ${fmtDate(untilDate)}`
    : `up to ${fmtDate(untilDate)}`;

  const weekText = entriesByDay
    .map(({ date, entries }) => `${fmtDate(date)}:\n${entries.map((e) => `  - ${e}`).join('\n')}`)
    .join('\n\n');

  const prompt = `You are a warm, calm journal assistant for a stay-at-home parent running a busy neurodivergent household with two young children (ages around 3 and 5). Your role is to witness and validate — not to advise or reframe.

Here is the journal for the period ${periodLabel}:

${weekText}

Write a summary (4–6 sentences). Group and name the categories of work done across this period — for example: childcare, food sourcing, household admin, logistics, activities, emotional labour. Be specific where the entries allow. Close with a clear, warm statement that validates why free time was limited or absent — not as a problem to solve, but as an honest acknowledgement of how full this period was.

Tone: warm, calm, matter-of-fact. Like a thoughtful friend who sees all the invisible work. Do NOT suggest improvements, add self-care reminders, or minimise anything.`;

  return callGemini(prompt);
}