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

const normalizeWeekdayName = (value: string | null | undefined) => {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(WEEKDAY_INDEX_BY_NAME, normalized) ? normalized : null;
};

const normalizeWeekdayIndex = (value: string | null | undefined) => {
  const normalized = normalizeWeekdayName(value);
  return normalized ? WEEKDAY_INDEX_BY_NAME[normalized] : null;
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

type ParsedRecurringValue = "daily" | "weekday" | "weekly" | "monthly" | "yearly" | null;
type StoreRecurringFrequency = "daily" | "weekday" | "weekly" | "monthly";

const WEEKDAY_NAME_BY_INDEX = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
const WEEKDAY_NAMES_PATTERN = "monday|tuesday|wednesday|thursday|friday|saturday|sunday";
const DUE_TODAY_PRIORITY_PATTERN = /\b(?:due|deadline|by|before)\s+(?:today|tonight|end\s+of\s+day|eod)\b|\b(?:today|tonight)\s+(?:deadline|due)\b/i;

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

const coercePositiveInteger = (value: unknown) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const normalized = Math.floor(value);
  return normalized > 0 ? normalized : null;
};

const coerceRecurringDay = (value: unknown, recurring: ParsedRecurringValue) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const normalized = Math.floor(value);

  if (recurring === "weekly") {
    return normalized >= 0 && normalized <= 6 ? normalized : null;
  }

  if (recurring === "monthly") {
    return normalized >= 1 && normalized <= 31 ? normalized : null;
  }

  return null;
};

const coerceRecurringDays = (value: unknown) => {
  if (!Array.isArray(value)) return undefined;
  const days = value
    .filter((day): day is number => typeof day === "number" && Number.isFinite(day))
    .map((day) => Math.floor(day))
    .filter((day) => day >= 0 && day <= 6);

  return days.length > 0 ? Array.from(new Set(days)) : undefined;
};

const coerceRecurringValue = (value: unknown): ParsedRecurringValue => {
  if (
    value === "daily" ||
    value === "weekday" ||
    value === "weekly" ||
    value === "monthly" ||
    value === "yearly"
  ) {
    return value;
  }

  return null;
};

const getRecurringWeekdayIndexes = (input: string) => {
  const normalized = input.toLowerCase();
  const weekdayListMatch = normalized.match(
    new RegExp(`\\b(?:every|each)\\s+([a-z,\\s]+?)(?:\\s+at\\b|[.!?;:]|$)`, "i")
  );
  if (!weekdayListMatch) return [];

  const weekdays = Array.from(
    weekdayListMatch[1].matchAll(new RegExp(`\\b(${WEEKDAY_NAMES_PATTERN})\\b`, "gi"))
  )
    .map((match) => normalizeWeekdayIndex(match[1]))
    .filter((day): day is number => day !== null);

  return Array.from(new Set(weekdays));
};

export const resolveParsedRecurringTodoFields = (task: Record<string, unknown>) => {
  const recurring = coerceRecurringValue(task.recurring) ?? coerceRecurringValue(task.recurringFrequency);
  const recurringDay = coerceRecurringDay(task.recurringDay, recurring);
  const explicitRecurringDays = coerceRecurringDays(task.recurringDays);
  const recurringInterval = coercePositiveInteger(task.recurringInterval);
  const existingCustomText =
    typeof task.recurringCustomText === "string" && task.recurringCustomText.trim().length > 0
      ? task.recurringCustomText.trim()
      : undefined;
  const weeklyDayLabel =
    recurring === "weekly" && recurringDay !== null ? WEEKDAY_NAME_BY_INDEX[recurringDay] : null;
  const recurringFrequency: StoreRecurringFrequency | undefined =
    recurring === "daily" || recurring === "weekday" || recurring === "weekly" || recurring === "monthly"
      ? recurring
      : undefined;

  return {
    isRecurring: task.isRecurring === true || recurring !== null,
    recurringFrequency,
    recurringDays:
      explicitRecurringDays ??
      (recurring === "weekly" && recurringDay !== null
        ? [recurringDay]
        : recurring === "weekday"
          ? [1, 2, 3, 4, 5]
          : undefined),
    recurringInterval: recurringInterval && recurringInterval > 1 ? recurringInterval : undefined,
    recurringCustomText:
      existingCustomText ??
      (recurring === "yearly"
        ? "yearly"
        : weeklyDayLabel
          ? `every ${weeklyDayLabel.toLowerCase()}`
          : recurring === "monthly" && recurringDay !== null
            ? `every month on day ${recurringDay}`
            : recurring === "weekday"
              ? "every weekday"
              : undefined),
  };
};

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

const getNextMonthlyOccurrenceUtc = (referenceDate: Date, dayOfMonth: number) => {
  const safeDay = Math.max(1, Math.min(dayOfMonth, 31));
  const year = referenceDate.getUTCFullYear();
  const month = referenceDate.getUTCMonth();
  const currentDay = referenceDate.getUTCDate();

  if (safeDay > currentDay) {
    const daysInCurrentMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    return new Date(Date.UTC(year, month, Math.min(safeDay, daysInCurrentMonth), 12, 0, 0, 0));
  }

  const nextMonthDate = new Date(Date.UTC(year, month + 1, 1, 12, 0, 0, 0));
  const nextMonthYear = nextMonthDate.getUTCFullYear();
  const nextMonth = nextMonthDate.getUTCMonth();
  const daysInNextMonth = new Date(Date.UTC(nextMonthYear, nextMonth + 1, 0)).getUTCDate();
  return new Date(Date.UTC(nextMonthYear, nextMonth, Math.min(safeDay, daysInNextMonth), 12, 0, 0, 0));
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

  const monthlyOrdinalMatch = normalized.match(
    /\b(?:on\s+)?the\s+(\d{1,2})(?:st|nd|rd|th)\s+of\s+(?:every|each)\s+month\b|\b(?:every|each)\s+month\s+on\s+the\s+(\d{1,2})(?:st|nd|rd|th)\b|\b(?:every|each)\s+(\d{1,2})(?:st|nd|rd|th)\s+of\s+the\s+month\b/
  );
  if (monthlyOrdinalMatch) {
    const matchedDay = monthlyOrdinalMatch[1] ?? monthlyOrdinalMatch[2] ?? monthlyOrdinalMatch[3];
    const dayOfMonth = Number.parseInt(matchedDay ?? "", 10);
    if (Number.isFinite(dayOfMonth) && dayOfMonth >= 1 && dayOfMonth <= 31) {
      return formatDateKey(getNextMonthlyOccurrenceUtc(referenceDate, dayOfMonth));
    }
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

export const detectRecurringPattern = (input: string) => {
  const normalized = input.toLowerCase();

  const monthlyOrdinalMatch = normalized.match(
    /\b(?:on\s+)?the\s+(\d{1,2})(?:st|nd|rd|th)\s+of\s+(?:every|each)\s+month\b|\b(?:every|each)\s+month\s+on\s+the\s+(\d{1,2})(?:st|nd|rd|th)\b|\b(?:every|each)\s+(\d{1,2})(?:st|nd|rd|th)\s+of\s+the\s+month\b/
  );
  if (monthlyOrdinalMatch) {
    const matchedDay = monthlyOrdinalMatch[1] ?? monthlyOrdinalMatch[2] ?? monthlyOrdinalMatch[3];
    const dayOfMonth = Number.parseInt(matchedDay ?? "", 10);
    if (Number.isFinite(dayOfMonth) && dayOfMonth >= 1 && dayOfMonth <= 31) {
      return {
        recurring: "monthly" as const,
        recurringDay: dayOfMonth,
      };
    }
  }

  if (/\bevery\s+weekday\b|\beach\s+weekday\b/.test(normalized)) {
    return {
      recurring: "weekday" as const,
      recurringDay: null,
      recurringDays: [1, 2, 3, 4, 5],
    };
  }

  const recurringWeekdays = getRecurringWeekdayIndexes(input);
  if (recurringWeekdays.length > 0) {
    return {
      recurring: "weekly" as const,
      recurringDay: recurringWeekdays[0] ?? null,
      recurringDays: recurringWeekdays,
    };
  }

  if (/\bdaily\b|\bevery\s+day\b|\beach\s+day\b|\beveryday\b/.test(normalized)) {
    return {
      recurring: "daily" as const,
      recurringDay: null,
      recurringDays: undefined,
    };
  }

  if (/\bmonthly\b|\bevery\s+month\b|\beach\s+month\b/.test(normalized)) {
    return {
      recurring: "monthly" as const,
      recurringDay: null,
      recurringDays: undefined,
    };
  }

  if (/\byearly\b|\bannually\b|\bevery\s+year\b|\beach\s+year\b/.test(normalized)) {
    return {
      recurring: "yearly" as const,
      recurringDay: null,
      recurringDays: undefined,
    };
  }

  const weeklyWeekdayMatch = normalized.match(
    /\b(?:every|each)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/
  );
  if (weeklyWeekdayMatch) {
    return {
      recurring: "weekly" as const,
      recurringDay: normalizeWeekdayIndex(weeklyWeekdayMatch[1]),
      recurringDays:
        normalizeWeekdayIndex(weeklyWeekdayMatch[1]) !== null
          ? [normalizeWeekdayIndex(weeklyWeekdayMatch[1]) as number]
          : undefined,
    };
  }

  if (/\bweekly\b|\bevery\s+week\b|\beach\s+week\b/.test(normalized)) {
    return {
      recurring: "weekly" as const,
      recurringDay: null,
      recurringDays: undefined,
    };
  }

  return {
    recurring: null,
    recurringDay: null,
    recurringDays: undefined,
  };
};

export const detectImplicitTaskPriority = (input: string) => {
  return DUE_TODAY_PRIORITY_PATTERN.test(input) ? "important" as const : undefined;
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
  const recurrence = detectRecurringPattern(rawInput);
  const titleBase = cleanShortcutTitle(extractExplicitSignals(rawInput).inputForModel || rawInput, explicit);
  const title = titleBase
    .replace(/\bset\s+to\s+repeat\b/gi, " ")
    .replace(/\brepeat\b/gi, " ")
    .replace(/\b(?:every|each)\s+weekday\b/gi, " ")
    .replace(/\b(?:every|each)\s+day\b/gi, " ")
    .replace(/\beveryday\b/gi, " ")
    .replace(/\b(?:every|each)\s+week\b/gi, " ")
    .replace(/\b(?:every|each)\s+month\b/gi, " ")
    .replace(/\b(?:every|each)\s+year\b/gi, " ")
    .replace(new RegExp(`\\b(?:every|each)\\s+(?:${WEEKDAY_NAMES_PATTERN})(?:\\s*(?:,|and)\\s*(?:${WEEKDAY_NAMES_PATTERN}))+`, "gi"), " ")
    .replace(/\b(?:every|each)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi, " ")
    .replace(/\b(?:on\s+)?the\s+\d{1,2}(?:st|nd|rd|th)\s+of\s+(?:every|each)\s+month\b/gi, " ")
    .replace(/\b(?:every|each)\s+month\s+on\s+the\s+\d{1,2}(?:st|nd|rd|th)\b/gi, " ")
    .replace(/\b(?:every|each)\s+\d{1,2}(?:st|nd|rd|th)\s+of\s+the\s+month\b/gi, " ")
    .replace(/\bon\s+the\s+\d{1,2}(?:st|nd|rd|th)\s+of\b/gi, " ")
    .replace(/\b(daily|weekly|monthly|yearly|annually)\b/gi, " ")
    .replace(/\b(today|tomorrow|tonight)\b/gi, " ")
    .replace(/\b(this|next)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi, " ")
    .replace(/\bon\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi, " ")
    .replace(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b(?=\s+at\b)/gi, " ")
    .replace(/\b\d{1,2}(?::\d{2})?\s*(am|pm)\b/gi, " ")
    .replace(/\b\d{1,2}:\d{2}\b/g, " ")
    .replace(/\bdue\b\s*[.!?]?$/i, " ")
    .replace(/\b(at|on|by|for|due)\b\s*$/i, " ")
    .replace(/\s*[:,-]\s*$/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!title) return null;

  return {
    title,
    date: detectFallbackDate(rawInput, referenceDateKey) ?? referenceDateKey,
    time: detectFallbackTime(rawInput),
    priority: detectImplicitTaskPriority(rawInput) ?? "normal" as const,
    location: explicit.location,
    duration: explicit.duration,
    reminder: explicit.reminder,
    recurring: recurrence.recurring,
    recurringDay: recurrence.recurringDay,
    recurringDays: recurrence.recurringDays,
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
