export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
}

export function getMaxDaysInMonth(year: number, month: number): number {
  switch (month) {
    case 1: // Jan
    case 3: // Mar
    case 5: // May
    case 7: // Jul
    case 8: // Aug
    case 10: // Oct
    case 12: // Dec
      return 31;
    case 4: // Apr
    case 6: // Jun
    case 9: // Sep
    case 11: // Nov
      return 30;
    case 2: // Feb
      return isLeapYear(year) ? 29 : 28;
    default:
      throw new Error(`Invalid month: ${month}`);
  }
}

function addDays(startDateStr: string, days: number): string {
  const [y, m, d] = startDateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  const ry = date.getUTCFullYear();
  const rm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const rd = String(date.getUTCDate()).padStart(2, "0");
  return `${ry}-${rm}-${rd}`;
}

export function getOccurrenceDate(
  startLocalDate: string,
  frequency: "daily" | "weekly" | "monthly" | "yearly",
  interval: number,
  index: number // 0-based index of occurrence
): string {
  if (index < 0) {
    throw new Error("Occurrence index must be non-negative");
  }
  if (index === 0) {
    return startLocalDate;
  }

  const offset = index * interval;
  const [startYear, startMonth, startDay] = startLocalDate.split("-").map(Number);

  if (frequency === "daily") {
    return addDays(startLocalDate, offset);
  } else if (frequency === "weekly") {
    return addDays(startLocalDate, offset * 7);
  } else if (frequency === "monthly") {
    const totalMonths = (startMonth - 1) + offset;
    const targetYear = startYear + Math.floor(totalMonths / 12);
    const targetMonth = (totalMonths % 12) + 1;
    const targetDay = Math.min(startDay, getMaxDaysInMonth(targetYear, targetMonth));
    const formattedMonth = String(targetMonth).padStart(2, "0");
    const formattedDay = String(targetDay).padStart(2, "0");
    return `${targetYear}-${formattedMonth}-${formattedDay}`;
  } else if (frequency === "yearly") {
    const targetYear = startYear + offset;
    const targetMonth = startMonth;
    const targetDay = Math.min(startDay, getMaxDaysInMonth(targetYear, targetMonth));
    const formattedMonth = String(targetMonth).padStart(2, "0");
    const formattedDay = String(targetDay).padStart(2, "0");
    return `${targetYear}-${formattedMonth}-${formattedDay}`;
  } else {
    throw new Error(`Unsupported frequency: ${frequency}`);
  }
}

/**
 * Calculates all occurrences from startLocalDate up to limitLocalDate (inclusive).
 * If endDate is set, occurrences after endDate are omitted.
 */
export function calculateOccurrenceSequence(
  startLocalDate: string,
  frequency: "daily" | "weekly" | "monthly" | "yearly",
  interval: number,
  limitLocalDate: string,
  endDate?: string | null
): string[] {
  const occurrences: string[] = [];
  let index = 0;

  while (true) {
    const occDate = getOccurrenceDate(startLocalDate, frequency, interval, index);

    // Stop if we exceed the limit date
    if (occDate > limitLocalDate) {
      break;
    }

    // Stop if we exceed the end date
    if (endDate && occDate > endDate) {
      break;
    }

    occurrences.push(occDate);
    index++;

    // Safety guard to prevent infinite loops
    if (index > 1000) {
      break;
    }
  }

  return occurrences;
}

/**
 * Formats a given timestamp into a YYYY-MM-DD string in the target timezone.
 */
export function getLocalDateInTimezone(timestampMs: number, timeZone: string): string {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(new Date(timestampMs));
  const year = parts.find((p) => p.type === "year")!.value;
  const month = parts.find((p) => p.type === "month")!.value;
  const day = parts.find((p) => p.type === "day")!.value;
  return `${year}-${month}-${day}`;
}
