import OpenAI from "openai";
import { NextResponse } from "next/server";
import { addMinutes, format, isValid } from "date-fns";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  buildHeuristicParsedTask,
  cleanShortcutTitle,
  detectFallbackDate,
  detectRecurringPattern,
  detectFallbackTime,
  detectImplicitTaskPriority,
  extractExplicitSignals,
  hasShortcutFields,
  normalizeIsoDate,
} from "@/lib/task-shortcuts";

export const dynamic = "force-dynamic";

if (!process.env.OPENAI_API_KEY) {
  console.error("/api/parse-task: OPENAI_API_KEY is not set — AI parsing will be unavailable")
}

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
  'due today', 'deadline today', 'by EOD' = important
  deadline + blocker = urgent, even without the word urgent:
  'send back before the 31st but I can't open attachment 2' = urgent
  'due tomorrow and the file will not open' = urgent
  everything else = normal
- Time of day implies reminders:
  'at 3pm' = schedule for 3pm AND set reminder for 3pm
- Relative times must be treated as scheduled times, not clock times:
  'in 10 min' = schedule 10 minutes from NOW and set reminder to 0
  'in 2 hours' = schedule 2 hours from NOW and set reminder to 0
- Additional field detection rules:
  - Phone numbers (any format: 212-555-1234, +1 212 555 1234, (212) 555-1234) → phone field, remove from title
  - URLs and domains (google.com, https://..., www...) → url field, remove from title
  - If user uses explicit signals like 'call:', 'link:', 'at:', 'duration:', 'remind:' extract to correct field
  - If user uses 'tag:', 'tags:', 'label:', or 'labels:' with comma-separated values, put those values in labels and remove that metadata from the title
  - Return phone as a string in the json response
- Duration words:
  'for 2 hours', 'takes about 30 mins' = duration
- Recurring patterns:
  'every month', 'monthly', 'each month' = recurring monthly
  'on the 1st', 'on the 15th' = recurringDay for monthly recurrence
  'every week', 'weekly', 'each week' = recurring weekly
  'every Thursday and Sunday' = recurring weekly and recurringDays [4,0]
  'every day', 'daily' = recurring daily
  'every year', 'yearly', 'annually' = recurring yearly
  'every Monday', 'every Tuesday' = recurring weekly and recurringDay is that weekday number
  'repeat', 'set to repeat', 'repeating' signal recurrence intent
  'remind me every...' is a recurring reminder/task
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
  recurringDay: number 1-31 for monthly day or 0-6 for weekly weekday (Sunday=0) or null,
  recurringDays: array of weekday numbers for weekly recurrences or null,
  notes: any extra context that does not fit above or null,
  url: any web address mentioned or null,
  phone: string or null,
  labels: array of relevant category strings or empty array
}`;

const formatTimeKey = (date: Date) => format(date, "HH:mm");
const formatDateKey = (date: Date) => format(date, "yyyy-MM-dd");

const resolveTimezone = (value: unknown) => {
  if (typeof value !== "string") return "UTC";
  const trimmed = value.trim();
  return trimmed || "UTC";
};

const getZonedParts = (date: Date, timeZone: string) => {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  const parts = formatter.formatToParts(date);
  const getPart = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";

  return {
    dateKey: `${getPart("year")}-${getPart("month")}-${getPart("day")}`,
    timeKey: `${getPart("hour")}:${getPart("minute")}`,
  };
};

const extractRelativeTimeMinutes = (rawInput: string) => {
  const input = rawInput.toLowerCase();
  // Support "in 10 min", "in 10 minutes", "after 2 hours", "in 45m", "in 1h"
  const match = input.match(/\b(?:in|after)\s+(\d+)\s*(minutes?|mins?|m|hours?|hrs?|h)\b/);
  if (!match) return null;

  const amount = Number.parseInt(match[1], 10);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const unit = match[2];
  const minutes =
    unit.startsWith("h") ? amount * 60 : amount;

  return { minutes, matchText: match[0] };
};

const normalizeDate = (value: unknown) => normalizeIsoDate(value);

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

const normalizeRecurringDay = (value: unknown, recurring: "daily" | "weekday" | "weekly" | "monthly" | "yearly" | null) => {
  const normalized = normalizeNumber(value)
  if (normalized === null) return null

  if (recurring === "weekly") {
    return normalized >= 0 && normalized <= 6 ? normalized : null
  }

  if (recurring === "monthly") {
    return normalized >= 1 && normalized <= 31 ? normalized : null
  }

  return null
}

const normalizeRecurringDays = (value: unknown, recurring: "daily" | "weekday" | "weekly" | "monthly" | "yearly" | null) => {
  if (recurring !== "weekly" && recurring !== "weekday") return null
  if (!Array.isArray(value)) return null

  const days = value
    .filter((day): day is number => typeof day === "number" && Number.isFinite(day))
    .map((day) => Math.floor(day))
    .filter((day) => day >= 0 && day <= 6)

  return days.length > 0 ? Array.from(new Set(days)) : null
}

const normalizePhone = (value: unknown) => {
  const phone = normalizeString(value);
  return phone ? phone : null;
};

const normalizeAttachment = (value: unknown) => {
  const attachment = normalizeString(value);
  return attachment ? attachment : null;
};

const sanitizeParsedTask = (raw: unknown) => {
  const task = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const title = normalizeString(task.title);

  if (!title || title.toLowerCase() === "unclear task") {
    return null;
  }

  const recurring =
    task.recurring === "daily" ||
    task.recurring === "weekday" ||
    task.recurring === "weekly" ||
    task.recurring === "monthly" ||
    task.recurring === "yearly"
      ? task.recurring
      : null

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
    recurring,
    recurringDay: normalizeRecurringDay(task.recurringDay, recurring),
    recurringDays: normalizeRecurringDays(task.recurringDays, recurring),
    notes: normalizeString(task.notes),
    url: normalizeString(task.url),
    phone: normalizePhone(task.phone),
    attachment: normalizeAttachment(task.attachment),
    labels: Array.isArray(task.labels)
      ? task.labels
          .filter((label): label is string => typeof label === "string")
          .map((label) => label.trim())
          .filter(Boolean)
      : [],
  };
};

export async function POST(req: Request) {
  const hasExplicitClockTime = (rawInput: string) => {
    return /\b(\d{1,2}:\d{2})\b|\b\d{1,2}\s*(am|pm)\b|\b\d{1,2}:\d{2}\s*(am|pm)\b/i.test(rawInput);
  };

  const hasExplicitDatePhrase = (rawInput: string) => {
    return /\b(tomorrow|tonight|next\s+(week|month|year)|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.test(
      rawInput
    );
  };

  const cleanTitleFallback = (rawInput: string) => {
    return rawInput
      .replace(/\s+/g, " ")
      .replace(/[.,;:!?]+$/g, "")
      .trim();
  };

  let body: Record<string, unknown> | null = null;

  try {
    // Require an authenticated user — this route spends OpenAI credits, so it
    // must not be callable anonymously.
    const supabase = await createSupabaseServerClient();
    const {
      data: { session },
      error: authError,
    } = await supabase.auth.getSession();
    if (authError) throw authError;
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "AI parsing is not configured" }, { status: 503 });
    }

    body = await req.json();
    const input = body?.input;
    const nowIso = typeof body?.now === "string" ? body.now : null;
    const userTimezone = resolveTimezone(body?.userTimezone);


    if (!input || typeof input !== "string" || input.trim() === "") {
      return NextResponse.json({ error: "Missing input" }, { status: 400 });
    }

    // Cap input length to bound token cost / abuse.
    if (input.length > 2000) {
      return NextResponse.json({ error: "Input too long" }, { status: 413 });
    }

    const now = nowIso ? new Date(nowIso) : new Date();
    const safeNow = isValid(now) ? now : new Date();
    const currentZoned = getZonedParts(safeNow, userTimezone);
    const today = currentZoned.dateKey;
    const currentTime = currentZoned.timeKey;

    const relative = extractRelativeTimeMinutes(input.trim());
    const relativeScheduledAt = relative ? addMinutes(safeNow, relative.minutes) : null;
    const relativeZoned = relativeScheduledAt ? getZonedParts(relativeScheduledAt, userTimezone) : null;
    const relativeDate = relativeZoned ? relativeZoned.dateKey : null;
    const relativeTime = relativeZoned ? relativeZoned.timeKey : null;

    // Remove relative time phrase from the model input so the title stays clean.
    const inputForModel = relative?.matchText
      ? input.trim().replace(new RegExp(`\\b${relative.matchText.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}\\b`, "i"), "").replace(/\s+/g, " ").trim()
      : input.trim();

    const { explicit, inputForModel: cleanedModelInput } = extractExplicitSignals(inputForModel);
    const finalModelInput = cleanedModelInput || inputForModel;
    const shortcutHeuristicTask = buildHeuristicParsedTask(finalModelInput || input.trim(), today, explicit);
    const hasExplicitShortcutSignals = finalModelInput !== inputForModel || hasShortcutFields(explicit);

    // Fast path: relative-time tasks are deterministic and don't need OpenAI.
    // This removes the lag for common cases like "call john in 10 min".
    if (relativeDate && relativeTime && !hasExplicitClockTime(finalModelInput) && !hasExplicitDatePhrase(finalModelInput)) {
      const title = cleanShortcutTitle(cleanTitleFallback(finalModelInput), explicit);
      if (title) {
        return NextResponse.json({
          title,
          date: relativeDate,
          time: relativeTime,
          priority: detectImplicitTaskPriority(input.trim()) ?? "normal",
          location: explicit.location,
          duration: explicit.duration,
          reminder: explicit.reminder ?? 0,
          recurring: null,
          recurringDay: null,
          recurringDays: null,
          notes: explicit.notes,
          url: explicit.url,
          phone: explicit.phone,
          attachment: explicit.attachment,
          labels: [],
        });
      }
    }

    // Fast path: explicit shortcut inputs are already structured enough for a
    // deterministic parse and should feel instant in the quick-add bar.
    if (hasExplicitShortcutSignals && shortcutHeuristicTask) {
      return NextResponse.json(shortcutHeuristicTask);
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 350,
      temperature: 0,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `The user's timezone is ${userTimezone}. Now is ${today} ${currentTime}. Today is ${today} in the user's timezone. Parse this task input and return only the JSON object: ${finalModelInput}`,
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

    // Deterministic override for relative-time phrases (prevents "10 min" being interpreted as "10:00").
    if (relativeDate && relativeTime) {
      sanitized.date = relativeDate;
      sanitized.time = relativeTime;
      sanitized.reminder = 0;
    }

    if (!sanitized.date) {
      sanitized.date = detectFallbackDate(input.trim(), today);
    }

    if (!sanitized.time) {
      sanitized.time = detectFallbackTime(input.trim());
    }

    const deterministicRecurrence = detectRecurringPattern(input.trim());
    sanitized.recurring = deterministicRecurrence.recurring ?? sanitized.recurring;
    sanitized.recurringDay = deterministicRecurrence.recurringDay ?? sanitized.recurringDay;
    sanitized.recurringDays = deterministicRecurrence.recurringDays ?? sanitized.recurringDays;

    const deterministicPriority = detectImplicitTaskPriority(input.trim());
    if (deterministicPriority && sanitized.priority === "normal") {
      sanitized.priority = deterministicPriority;
    }

    sanitized.phone = explicit.phone ?? sanitized.phone;
    sanitized.url = explicit.url ?? sanitized.url;
    sanitized.location = explicit.location ?? sanitized.location;
    sanitized.duration = explicit.duration ?? sanitized.duration;
    sanitized.reminder = explicit.reminder ?? sanitized.reminder;
    sanitized.notes = explicit.notes ?? sanitized.notes;
    sanitized.attachment = explicit.attachment ?? sanitized.attachment;
    sanitized.title = cleanShortcutTitle(sanitized.title, explicit);

    return NextResponse.json(sanitized);
  } catch (err) {
    console.error("parse-task error:", err);
    const fallbackInput = typeof body?.input === "string" ? body.input.trim() : "";
    const fallbackTimezone = resolveTimezone(body?.userTimezone);
    const fallbackNow = typeof body?.now === "string" ? new Date(body.now) : new Date();
    const safeFallbackNow = isValid(fallbackNow) ? fallbackNow : new Date();
    const fallbackToday = getZonedParts(safeFallbackNow, fallbackTimezone).dateKey;

    if (fallbackInput) {
      const { explicit, inputForModel: cleanedModelInput } = extractExplicitSignals(fallbackInput);
      const heuristicTask = buildHeuristicParsedTask(cleanedModelInput || fallbackInput, fallbackToday, explicit);
      if (heuristicTask) {
        return NextResponse.json(heuristicTask);
      }
    }

    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
