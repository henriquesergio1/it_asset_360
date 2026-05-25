import { TaskRecurrenceConfig, RecurrenceType } from '../types';

export function getRecurrenceDescription(config?: TaskRecurrenceConfig): string {
  if (!config) return 'Nenhuma';
  switch (config.type) {
    case RecurrenceType.MONTHLY_DAY:
      return `Mensal (Todo dia ${config.dayOfMonth})`;
    case RecurrenceType.MONTHLY_WEEKDAY: {
      const weekdays = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
      const weeks = ['', 'Primeira', 'Segunda', 'Terceira', 'Quarta', 'Última'];
      const weekStr = weeks[config.weekOfMonth || 1] || 'Primeira';
      const dayStr = weekdays[config.dayOfWeek ?? 1] || 'Segunda-feira';
      return `Mensal (${weekStr} ${dayStr})`;
    }
    case RecurrenceType.INTERVAL_MONTHS:
      return `A cada ${config.intervalMonths || 1} meses`;
    default:
      return 'Nenhuma';
  }
}

export function parseLocalDate(dateStr: string): Date {
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    return new Date(year, month, day, 12, 0, 0, 0);
  }
  const d = new Date(dateStr);
  d.setHours(12, 0, 0, 0);
  return d;
}

export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getNextOccurrence(config?: TaskRecurrenceConfig, fromDate: Date = new Date()): Date {
  const result = new Date(fromDate);
  result.setHours(12, 0, 0, 0);

  if (!config || config.type === RecurrenceType.NONE) {
    return result;
  }

  switch (config.type) {
    case RecurrenceType.MONTHLY_DAY: {
      const day = config.dayOfMonth || 1;
      const currentDay = result.getDate();
      
      if (currentDay < day) {
        result.setDate(day);
      } else {
        result.setMonth(result.getMonth() + 1);
        result.setDate(day);
      }
      break;
    }
    case RecurrenceType.MONTHLY_WEEKDAY: {
      const weekOfMonth = config.weekOfMonth || 1;
      const dayOfWeek = config.dayOfWeek ?? 1;
      
      let candidate = findNthWeekdayOfMonth(result.getFullYear(), result.getMonth(), weekOfMonth, dayOfWeek);
      if (candidate.getTime() <= result.getTime()) {
        let nextMonth = result.getMonth() + 1;
        let year = result.getFullYear();
        if (nextMonth > 11) {
          nextMonth = 0;
          year += 1;
        }
        candidate = findNthWeekdayOfMonth(year, nextMonth, weekOfMonth, dayOfWeek);
      }
      return candidate;
    }
    case RecurrenceType.INTERVAL_MONTHS: {
      const interval = config.intervalMonths || 1;
      result.setMonth(result.getMonth() + interval);
      break;
    }
    default:
      break;
  }
  return result;
}

function findNthWeekdayOfMonth(year: number, month: number, n: number, dayOfWeek: number): Date {
  const date = new Date(year, month, 1, 12, 0, 0, 0);
  const days: Date[] = [];
  while (date.getMonth() === month) {
    if (date.getDay() === dayOfWeek) {
      days.push(new Date(date));
    }
    date.setDate(date.getDate() + 1);
  }
  if (n === 5) {
    const last = days[days.length - 1] || new Date(year, month, 1, 12, 0, 0, 0);
    last.setHours(12, 0, 0, 0);
    return last;
  }
  const selected = days[n - 1] || days[days.length - 1] || new Date(year, month, 1, 12, 0, 0, 0);
  selected.setHours(12, 0, 0, 0);
  return selected;
}
