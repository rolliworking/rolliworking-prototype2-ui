import { addWeeks, differenceInCalendarDays, startOfDay } from "date-fns";

export function parseDateLocal(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function formatDateLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getTodayLocalDate(): Date {
  return startOfDay(new Date());
}

export function getWeeksToTargetFromDate(targetDate: string): number {
  const daysUntilTarget = differenceInCalendarDays(parseDateLocal(targetDate), getTodayLocalDate());
  return Math.max(0, Math.round(daysUntilTarget / 7));
}

export function resolveTargetDate(params: {
  customTargetDate?: string;
  originalTargetDate?: string | null;
  initialWeeksToTarget?: number | null;
  weeksToTarget: number;
}): Date | null {
  const { customTargetDate, weeksToTarget } = params;

  // Manual date override always wins
  if (customTargetDate) {
    return parseDateLocal(customTargetDate);
  }

  // Simple: N weeks from today
  if (weeksToTarget > 0) {
    return addWeeks(getTodayLocalDate(), weeksToTarget);
  }

  return null;
}
