import { format, isValid, parseISO } from "date-fns";

const WEEKDAY_INDEX_BY_NAME: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

const explicitMarkerPattern =
  /(?:\bcall:|📞|\blink:|\burl:|🔗|\bat:|\bloc:|📍|\bduration:|\bfor:|⏱|\bremind:|🔔|\bnote:|📝|\battach:|📎)/i;
const dateTimeBoundaryPattern =
  /\s+(?:today|tomorrow|tonight|this\s+(?:week|month|year|monday|tuesday|wednesday|thursday|friday|saturday|sunday)|next\s+(?:week|month|year|monday|tuesday|wednesday|thursday|friday|saturday|sunday)|monday|tuesday|wednesday|thursday|friday|saturday|sunday|in\s+\d+\s*(?:minutes?|mins?|m|hours?|hrs?|h|days?)|after\s+\d+\s*(?:minutes?|mins?|m|hours?|hrs?|h|days?)|\d{1,2}(?::\d{2})?\s*(?:am|pm)|\d{1,2}:\d{2}|\d{4}-\d{2}-\d{2})\b/i;
const phonePattern = /(?:\+?\d[\d()\-\s]{6,}\d)/;
const urlPattern = /(?:https?:\/\/[^\s,;]+|www\.[^\s,;]+|[a-z0-9-]+\.[a-z]{2,}(?:\/[^\s,;]*)?)/i;

export type ExtractedShortcutFields = {
  phone: string | null;
  url: string | null;
  location: string | null;
  duration: number | null;
  reminder: number | null;
  notes: string | null;
  attachment: string | null;
};

export const hasShortcutFields = (fields: ExtractedShortcutFields) =>
  Boolean(
    fields.phone ||
    fields.url ||
    fields.location ||
    fields.duration != null ||
    fields.reminder != null ||
    fields.notes ||
    fields.attachment
  );

const formatDateKey = (date: Date) => format(date, "yyyy-MM-dd");

const stripToken = (source: string, token: string) =>
  source.replace(token, " ").replace(/\s+/g, " ").trim();

const extractField = (
  source: string,
  markerRegex: RegExp,
  options?: {
    stopAtDateTime?: boolean;
    valueRegex?: RegExp;
  }
) => {
  const match = markerRegex.exec(source);
  if (!match) {
    return { value: null as string | null, nextInput: source };
  }

  const startIndex = match.index;
  const valueStart = startIndex + match[0].length;
  const tail = source.slice(valueStart);
  const nextMarkerIndex = tail.search(explicitMarkerPattern);
  const dateBoundaryIndex = options?.stopAtDateTime ? tail.search(dateTimeBoundaryPattern) : -1;

  let valueEnd = tail.length;
  if (nextMarkerIndex >= 0) valueEnd = Math.min(valueEnd, nextMarkerIndex);
  if (dateBoundaryIndex >= 0) valueEnd = Math.min(valueEnd, dateBoundaryIndex);

  const candidate = tail.slice(0, valueEnd).trim().replace(/^[\-:–—\s]+/, "").trim();
  let value = candidate;
  let consumedLength = candidate.length;

  if (options?.valueRegex) {
    const valueMatch = candidate.match(options.valueRegex);
    value = valueMatch?.[0]?.trim() ?? "";
    if (valueMatch?.index != null && value) {
      consumedLength = valueMatch.index + valueMatch[0].length;
    }
  }

  if (!value) {
    return { value: null as string | null, nextInput: source };
  }

  const tokenToRemove = source.slice(startIndex, valueStart + consumedLength);
  return {
    value,
    nextInput: stripToken(source, tokenToRemove),
  };
};

export const parseMinutesValue = (value: string | null) => {
  if (!value) return null;
  const normalized = value.toLowerCase();
  const match = normalized.match(/(\d+)\s*(minutes?|mins?|m|hours?|hrs?|h|days?)/);
  if (!match) return null;

  const amount = Number.parseInt(match[1], 10);
  if (!Number.isFinite(amount) || amount < 0) return null;

  const unit = match[2];
  if (unit.startsWith("day")) return amount * 1440;
  if (unit.startsWith("h")) return amount * 60;
  return amount;
};

const addDaysUtc = (date: Date, amount: number) => {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + amount);
  return next;
};

export const detectFallbackDate = (input: string, referenceDateKey: string) => {
  const normalized = input.toLowerCase();
  const referenceDate = new Date(`${referenceDateKey}T12:00:00.000Z`);

  if (/\btoday\b/.test(normalized)) {
    return referenceDateKey;
  }

  if (/\btomorrow\b/.test(normalized)) {
    return formatDateKey(addDaysUtc(referenceDate, 1));
  }

  const weekdayMatch = normalized.match(/\b(?:(next|this)\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/);
  if (weekdayMatch) {
    const modifier = weekdayMatch[1] ?? null;
    const weekday = WEEKDAY_INDEX_BY_NAME[weekdayMatch[2]];
    const currentWeekday = referenceDate.getUTCDay();
    let daysUntil = (weekday - currentWeekday + 7) % 7;

    if (modifier === "next") {
      daysUntil = daysUntil === 0 ? 7 : daysUntil + 7;
    } else if (modifier === "this") {
      daysUntil = daysUntil === 0 ? 0 : daysUntil;
    } else if (daysUntil === 0) {
      daysUntil = 7;
    }

    return formatDateKey(addDaysUtc(referenceDate, daysUntil));
  }

  return null;
};

export const detectFallbackTime = (input: string) => {
  const normalized = input.toLowerCase();
  const twelveHourMatch = normalized.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/);
  if (twelveHourMatch) {
    const baseHour = Number.parseInt(twelveHourMatch[1], 10) % 12;
    const minutes = Number.parseInt(twelveHourMatch[2] ?? "0", 10);
    const hour = twelveHourMatch[3] === "pm" ? baseHour + 12 : baseHour;
    return `${String(hour).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }

  const twentyFourHourMatch = normalized.match(/\b(\d{1,2}):(\d{2})\b/);
  if (twentyFourHourMatch) {
    const hour = Number.parseInt(twentyFourHourMatch[1], 10);
    const minutes = Number.parseInt(twentyFourHourMatch[2], 10);
    if (hour >= 0 && hour <= 23 && minutes >= 0 && minutes <= 59) {
      return `${String(hour).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
    }
  }

  return null;
};

export const extractExplicitSignals = (rawInput: string) => {
  let nextInput = rawInput.trim();

  const phoneExplicit = extractField(nextInput, /(?:\bcall:|📞)\s*/i, {
    valueRegex: phonePattern,
    stopAtDateTime: true,
  });
  nextInput = phoneExplicit.nextInput;

  const urlExplicit = extractField(nextInput, /(?:\blink:|\burl:|🔗)\s*/i, {
    valueRegex: urlPattern,
    stopAtDateTime: true,
  });
  nextInput = urlExplicit.nextInput;

  const locationExplicit = extractField(nextInput, /(?:\bat:|\bloc:|📍)\s*/i, {
    stopAtDateTime: true,
  });
  nextInput = locationExplicit.nextInput;

  const durationExplicit = extractField(nextInput, /(?:\bduration:|\bfor:|⏱)\s*/i, {
    valueRegex: /[^,;]+/,
    stopAtDateTime: true,
  });
  nextInput = durationExplicit.nextInput;

  const reminderExplicit = extractField(nextInput, /(?:\bremind:|🔔)\s*/i, {
    valueRegex: /[^,;]+/,
    stopAtDateTime: true,
  });
  nextInput = reminderExplicit.nextInput;

  const noteExplicit = extractField(nextInput, /(?:\bnote:|📝)\s*/i, { valueRegex: /[^]+/ });
  nextInput = noteExplicit.nextInput;

  const attachmentExplicit = extractField(nextInput, /(?:\battach:|📎)\s*/i, { valueRegex: /[^]+/ });
  nextInput = attachmentExplicit.nextInput;

  const inferredPhoneMatch = nextInput.match(phonePattern);
  const inferredUrlMatch = nextInput.match(urlPattern);

  const phone = phoneExplicit.value ?? inferredPhoneMatch?.[0]?.trim() ?? null;
  if (!phoneExplicit.value && inferredPhoneMatch?.[0]) {
    nextInput = stripToken(nextInput, inferredPhoneMatch[0]);
  }

  const url = urlExplicit.value ?? inferredUrlMatch?.[0]?.trim() ?? null;
  if (!urlExplicit.value && inferredUrlMatch?.[0]) {
    nextInput = stripToken(nextInput, inferredUrlMatch[0]);
  }

  return {
    inputForModel: nextInput.replace(/\s+/g, " ").trim(),
    explicit: {
      phone,
      url,
      location: locationExplicit.value,
      duration: parseMinutesValue(durationExplicit.value),
      reminder: parseMinutesValue(reminderExplicit.value),
      notes: noteExplicit.value,
      attachment: attachmentExplicit.value,
    } satisfies ExtractedShortcutFields,
  };
};

export const cleanShortcutTitle = (title: string, explicit: ExtractedShortcutFields) => {
  let next = title;

  [
    explicit.phone,
    explicit.url,
    explicit.location,
    explicit.notes,
    explicit.attachment,
  ].forEach((value) => {
    if (!value) return;
    next = next.replace(value, " ");
  });

  next = next
    .replace(explicitMarkerPattern, " ")
    .replace(/\s+/g, " ")
    .replace(/[.,;:!?]+$/g, "")
    .trim();

  return next || title.trim();
};

export const buildHeuristicParsedTask = (
  rawInput: string,
  referenceDateKey: string,
  explicit: ExtractedShortcutFields,
) => {
  const titleBase = cleanShortcutTitle(extractExplicitSignals(rawInput).inputForModel || rawInput, explicit);
  const title = titleBase
    .replace(/\b(today|tomorrow|tonight)\b/gi, " ")
    .replace(/\b(this|next)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi, " ")
    .replace(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi, " ")
    .replace(/\b\d{1,2}(?::\d{2})?\s*(am|pm)\b/gi, " ")
    .replace(/\b\d{1,2}:\d{2}\b/g, " ")
    .replace(/\b(at|on|by|for)\b\s*$/i, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!title) return null;

  return {
    title,
    date: detectFallbackDate(rawInput, referenceDateKey) ?? referenceDateKey,
    time: detectFallbackTime(rawInput),
    priority: "normal" as const,
    location: explicit.location,
    duration: explicit.duration,
    reminder: explicit.reminder,
    recurring: null,
    recurringDay: null,
    notes: explicit.notes,
    url: explicit.url,
    phone: explicit.phone,
    attachment: explicit.attachment,
    labels: [],
  };
};

export const normalizeIsoDate = (value: unknown) => {
  if (value === null) return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  const parsed = parseISO(trimmed);
  return isValid(parsed) ? format(parsed, "yyyy-MM-dd") : null;
};
