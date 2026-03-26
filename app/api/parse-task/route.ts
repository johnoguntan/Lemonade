import OpenAI from "openai";
import { NextResponse } from "next/server";
import { format, isValid, parseISO } from "date-fns";

export const dynamic = "force-dynamic";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const WEEKDAY_PATTERN = "\\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\\b";

const formatDateKey = (date: Date) => date.toISOString().split("T")[0];

const addDays = (date: Date, amount: number) => {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + amount);
  return nextDate;
};

const splitInputFragments = (input: string) =>
  input
    .split(/\s*(?:,|and then|after that|also|plus|then)\s*/i)
    .map((fragment) => fragment.trim())
    .filter(Boolean);

const detectSharedDate = (input: string, today: Date) => {
  const firstFragment = splitInputFragments(input)[0]?.toLowerCase() ?? "";

  if (/\b(?:tomorrow|tmr)\b/.test(firstFragment)) {
    return formatDateKey(addDays(today, 1));
  }

  if (/\btoday\b/.test(firstFragment)) {
    return formatDateKey(today);
  }

  if (/\bnext week\b/.test(firstFragment)) {
    const nextMonday = new Date(today);
    const day = nextMonday.getDay();
    const daysUntilNextMonday = ((8 - day) % 7) || 7;
    nextMonday.setDate(nextMonday.getDate() + daysUntilNextMonday);
    return formatDateKey(nextMonday);
  }

  return null;
};

const hasExplicitDateOverride = (fragment: string) => {
  const normalized = fragment.toLowerCase();

  return (
    /\b(?:today|tomorrow|tmr|next week)\b/.test(normalized) ||
    new RegExp(`\\b(?:on|by|this|next)\\s+${WEEKDAY_PATTERN.slice(2, -2)}\\b`, "i").test(normalized) ||
    new RegExp(`${WEEKDAY_PATTERN}\\s+at\\b`, "i").test(normalized) ||
    /\b\d{4}-\d{2}-\d{2}\b/.test(normalized) ||
    /\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/.test(normalized)
  );
};

const normalizeIsoDate = (value: unknown) => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return null;
  }

  const parsed = parseISO(trimmed);
  if (!isValid(parsed)) {
    return null;
  }

  return format(parsed, "yyyy-MM-dd");
};

export async function POST(req: Request) {
  try {
    const { input } = await req.json();

    if (!input || typeof input !== "string" || input.trim() === "") {
      return NextResponse.json([], { status: 200 });
    }

    const referenceDate = new Date();
    const today = formatDateKey(referenceDate);

    const SYSTEM_PROMPT = `
You are a strict but forgiving task parser.
Today's date is ${today}.
Convert natural language into a JSON array of task objects.
Handle typos, abbreviations, run-on sentences, and messy human writing gracefully.

Each task must follow this exact schema:
{
  "title": string,
  "date": string | null,
  "time": string | null,
  "labels": string[],
  "priority": "low" | "medium" | "high" | null,
  "isRecurring": boolean | null,
  "recurringFrequency": "daily" | "weekday" | "weekly" | "monthly" | null,
  "recurringDays": number[] | null
}

RULES:

1. MULTIPLE TASKS
- Split into separate tasks when you detect more than one action
- Split on: "then", "and then", "after that", "also", "plus", "and", commas
- If one date applies to all tasks in the sentence, copy it to every task
- If a shared date appears early in the sentence, keep using that shared date for later comma-separated tasks unless a later task has a clearly explicit replacement date
- If a time applies to only one task, only assign it to that task
- Example: "call Mike tmr, gym 6am, send invoice friday #finance urgent" should be treated as three tasks that all inherit tomorrow unless the last fragment clearly says "on Friday", "by Friday", "this Friday", or "next Friday"

2. TITLE
- Keep it short and clean
- Remove date, time, label, and priority words from the title
- Fix obvious typos (e.g. "thereapist" → "therapist", "resutunet" → "restaurant")
- Expand abbreviations: tmr=tomorrow, eod=17:00, mtg=meeting, appt=appointment, w/=with

3. DATE
- Today is ${today}. Use this as the reference for all relative dates.
- You must return the current year (2026) for all relative dates.
- If the user says "Next Thursday", calculate the exact date based on today (${today}).
- Convert:
  - today → ${today}
  - tomorrow / tmr → today + 1 day
  - next week → next Monday
  - monday/tuesday/etc → next occurrence of that weekday
  - next monday/tuesday/etc → the monday/tuesday after next
- Always output YYYY-MM-DD
- Never output partial dates, month/day only, or dates without the full 4-digit year
- If no date mentioned → null
- Date precedence rule:
  - A leading shared date like "today", "tomorrow", "tmr", or "next week" should apply to all subsequent split tasks by default
  - Do not override that shared date because of a bare weekday word inside a later task fragment unless it is clearly attached with date language like "on Friday", "by Friday", "this Friday", "next Friday", or "Friday at 2pm"
  - If a weekday word is ambiguous after a shared date already exists, prefer keeping the shared date and leave the weekday word in the title if needed

4. TIME
- Convert to 24h HH:MM format:
  - morning → 09:00
  - afternoon → 13:00
  - evening → 18:00
  - night → 21:00
  - noon → 12:00
  - eod / end of day → 17:00
  - "4pm" → 16:00
  - "6:30am" → 06:30
  - "by 2pm" → 14:00 (strip the word "by")
- If no time → null

5. LABELS
- Extract #hashtags, strip the # symbol
- Example: "#work meeting" → labels: ["work"]
- If none → []

6. PRIORITY
- high / urgent / asap / important → "high"
- medium / normal → "medium"
- low / whenever → "low"
- If none detected → null

7. RECURRENCE
- Detect phrases like:
  - every day → { isRecurring: true, recurringFrequency: "daily", recurringDays: null }
  - every weekday → { isRecurring: true, recurringFrequency: "weekday", recurringDays: null }
  - weekly → { isRecurring: true, recurringFrequency: "weekly", recurringDays: null }
  - monthly → { isRecurring: true, recurringFrequency: "monthly", recurringDays: null }
  - every monday / every tue-thu style weekday list → { isRecurring: true, recurringFrequency: "weekly", recurringDays: [0-6...] }
- If not recurring → isRecurring: null, recurringFrequency: null, recurringDays: null

8. MESSY INPUT HANDLING
- Ignore filler words: "we are going to", "I need to", "don't forget to", "make sure to"
- Handle run-on sentences with no punctuation
- Handle ALL CAPS, no caps, mixed caps
- Handle repeated words or half-finished sentences — use best judgment
- If completely unintelligible → return { "title": "Unclear task", "date": null, "time": null, "labels": [], "priority": null, "isRecurring": null, "recurringFrequency": null, "recurringDays": null }

9. OUTPUT FORMAT
- Return ONLY valid JSON array
- No explanation, no markdown, no backticks
- Always return an array even for a single task
- Never return invalid JSON under any circumstance
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 300,
      temperature: 0,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: input }
      ],
    });

    const text = completion.choices[0].message.content ?? "[]";
    const cleaned = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);

    if (!Array.isArray(parsed)) return NextResponse.json([], { status: 200 });

    const sharedDate = detectSharedDate(input, referenceDate);
    const fragments = splitInputFragments(input);
    const normalized = sharedDate
      ? parsed.map((task, index) => {
          const fragment = fragments[index] ?? "";

          if (hasExplicitDateOverride(fragment)) {
            return task;
          }

          return {
            ...task,
            date: sharedDate,
          };
        })
      : parsed;

    const sanitized = normalized.map((task) => ({
      ...task,
      title: typeof task?.title === "string" ? task.title : "",
      date: normalizeIsoDate(task?.date),
      time: typeof task?.time === "string" ? task.time : null,
      labels: Array.isArray(task?.labels) ? task.labels.filter((label): label is string => typeof label === "string") : [],
      priority:
        task?.priority === "low" || task?.priority === "medium" || task?.priority === "high"
          ? task.priority
          : null,
      isRecurring: task?.isRecurring === true ? true : null,
      recurringFrequency:
        task?.recurringFrequency === "daily" ||
        task?.recurringFrequency === "weekday" ||
        task?.recurringFrequency === "weekly" ||
        task?.recurringFrequency === "monthly"
          ? task.recurringFrequency
          : null,
      recurringDays: Array.isArray(task?.recurringDays)
        ? task.recurringDays.filter((day): day is number => typeof day === "number")
        : null,
    }));

    return NextResponse.json(sanitized);

  } catch (err) {
    console.error("parse-task error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
