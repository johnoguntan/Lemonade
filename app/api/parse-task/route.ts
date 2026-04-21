import OpenAI from "openai";
import { NextResponse } from "next/server";
import { format, isValid, parseISO } from "date-fns";

export const dynamic = "force-dynamic";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `You are an expert task parser for a smart productivity app 
called Alessandro. Your job is to deeply understand what the 
user means — not just what they literally say.

You must extract structured task data from any natural language 
input, no matter how casual, ambiguous, or complex.

RULES FOR UNDERSTANDING INTENT:
- Understand the CORE ACTION — what does the user actually 
  need to DO?
- Dates mentioned as CONTEXT are not due dates:
  'Tell Ricardo the doors are coming Tuesday' = do today, 
  Tuesday is just content
  'Remind me to call John on Tuesday' = due Tuesday
- Locations in task descriptions are task locations, not dates:
  'Pick up grapes at Trader Joes on 72nd and Columbus in Manhattan'
  = location is 'Trader Joes, 72nd & Columbus, Manhattan'
- Location phrases often look like:
  'at [place] on [street/address] in [city/neighborhood]'
  In these cases, the word 'on' introduces the street/address,
  not a scheduled date.
- Urgency words imply priority:
  'asap', 'urgent', 'critical', 'right away' = urgent
  'important', 'don't forget', 'make sure' = important
  deadline + blocker = urgent, even without the word urgent:
  'send back before the 31st but I can't open attachment 2' = urgent
  'due tomorrow and the file will not open' = urgent
  everything else = normal
- Time of day implies reminders:
  'at 3pm' = schedule for 3pm AND set reminder for 3pm
- Duration words:
  'for 2 hours', 'takes about 30 mins' = duration
- Recurring patterns:
  'every Monday', 'daily', 'each week' = recurring
- If no date mentioned = today
- If no priority mentioned = normal
- Clean up the title — remove date/time/location info 
  from the title, keep only the core action
- Never guess — if something is truly ambiguous leave it null
- Always return ONLY valid JSON, no markdown, no explanation

SMART EXAMPLES:
- 'pick up grapes at trader joe on 72nd and columbus in manhattan'
  title: "Pick up grapes"
  date: today's YYYY-MM-DD from the user message
  location: "Trader Joe's, 72nd & Columbus, Manhattan, NY"
  priority: "normal"
- 'lunch with sarah at nobu in tribeca on thursday at 1pm'
  title: "Lunch with Sarah"
  date: this Thursday as YYYY-MM-DD
  time: "13:00"
  reminder: 0
  location: "Nobu, Tribeca, New York"

Return this exact JSON structure:
{
  title: string (clean core action only),
  date: YYYY-MM-DD or null,
  time: HH:MM or null,
  priority: urgent | important | normal,
  location: full place name and address or null,
  duration: number in minutes or null,
  reminder: number in minutes before or null,
  recurring: daily | weekly | monthly | yearly | null,
  recurringDay: day of week if weekly e.g. monday or null,
  notes: any extra context that does not fit above or null,
  url: any web address mentioned or null,
  labels: array of relevant category strings or empty array
}`;

const formatDateKey = (date: Date) => format(date, "yyyy-MM-dd");

const normalizeDate = (value: unknown) => {
  if (value === null) return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  const parsed = parseISO(trimmed);
  return isValid(parsed) ? format(parsed, "yyyy-MM-dd") : null;
};

const normalizeTime = (value: unknown) => {
  if (value === null) return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return /^\d{2}:\d{2}$/.test(trimmed) ? trimmed : null;
};

const normalizeString = (value: unknown) => {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const normalizeNumber = (value: unknown) => {
  if (value === null || value === undefined) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  return Math.floor(value);
};

const sanitizeParsedTask = (raw: unknown) => {
  const task = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const title = normalizeString(task.title);

  if (!title || title.toLowerCase() === "unclear task") {
    return null;
  }

  return {
    title,
    date: normalizeDate(task.date),
    time: normalizeTime(task.time),
    priority:
      task.priority === "urgent" || task.priority === "important" || task.priority === "normal"
        ? task.priority
        : "normal",
    location: normalizeString(task.location),
    duration: normalizeNumber(task.duration),
    reminder: normalizeNumber(task.reminder),
    recurring:
      task.recurring === "daily" ||
      task.recurring === "weekly" ||
      task.recurring === "monthly" ||
      task.recurring === "yearly"
        ? task.recurring
        : null,
    recurringDay: normalizeString(task.recurringDay)?.toLowerCase() ?? null,
    notes: normalizeString(task.notes),
    url: normalizeString(task.url),
    labels: Array.isArray(task.labels)
      ? task.labels
          .filter((label): label is string => typeof label === "string")
          .map((label) => label.trim())
          .filter(Boolean)
      : [],
  };
};

export async function POST(req: Request) {
  try {
    const { input } = await req.json();

    if (!input || typeof input !== "string" || input.trim() === "") {
      return NextResponse.json({ error: "Missing input" }, { status: 400 });
    }

    const today = formatDateKey(new Date());
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 350,
      temperature: 0,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Today is ${today}. Parse this task input and return only the JSON object: ${input.trim()}`,
        },
      ],
    });

    const text = completion.choices[0]?.message?.content ?? "";
    const cleaned = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    const sanitized = sanitizeParsedTask(parsed);

    if (!sanitized) {
      return NextResponse.json({ error: "Unable to parse task" }, { status: 422 });
    }

    return NextResponse.json(sanitized);
  } catch (err) {
    console.error("parse-task error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
