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

export function getNextOccurrence(config?: TaskRecurrenceConfig, fromDate: Date = new Date()): Date {
  const result = new Date(fromDate);
  result.setHours(0, 0, 0, 0);

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
  const date = new Date(year, month, 1);
  const days: Date[] = [];
  while (date.getMonth() === month) {
    if (date.getDay() === dayOfWeek) {
      days.push(new Date(date));
    }
    date.setDate(date.getDate() + 1);
  }
  if (n === 5) {
    return days[days.length - 1] || new Date(year, month, 1);
  }
  return days[n - 1] || days[days.length - 1] || new Date(year, month, 1);
}
