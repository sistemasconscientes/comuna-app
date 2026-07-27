import {
  buildDailyReminderDates,
  formatReminderTime,
  isDailyReminderId,
  parseReminderTime,
  reminderIdForDate,
} from './reminderSchedule';

describe('buildDailyReminderDates', () => {
  const now = new Date(2026, 6, 26, 18, 30); // 26 jul, 18:30

  it('incluye hoy si la hora no pasó y no está completo', () => {
    const dates = buildDailyReminderDates({ now, hour: 21, minute: 0, skipToday: false });
    expect(dates).toHaveLength(7);
    expect(dates[0]!.getDate()).toBe(26);
    expect(dates[0]!.getHours()).toBe(21);
  });

  it('salta hoy si el registro ya está completo', () => {
    const dates = buildDailyReminderDates({ now, hour: 21, minute: 0, skipToday: true });
    expect(dates[0]!.getDate()).toBe(27);
  });

  it('salta hoy si la hora ya pasó', () => {
    const dates = buildDailyReminderDates({ now, hour: 17, minute: 0, skipToday: false });
    expect(dates[0]!.getDate()).toBe(27);
  });

  it('cruza fin de mes con días civiles', () => {
    const endOfMonth = new Date(2026, 6, 30, 10, 0);
    const dates = buildDailyReminderDates({
      now: endOfMonth,
      hour: 21,
      minute: 0,
      skipToday: true,
    });
    expect(dates[1]!.getMonth()).toBe(7); // 1 ago
    expect(dates[1]!.getDate()).toBe(1);
  });
});

describe('reminderIdForDate / isDailyReminderId', () => {
  it('id estable por día local', () => {
    const id = reminderIdForDate(new Date(2026, 6, 26, 21, 0));
    expect(id).toBe('daily-log-2026-07-26');
    expect(isDailyReminderId(id)).toBe(true);
    expect(isDailyReminderId('otra-cosa')).toBe(false);
  });
});

describe('parseReminderTime / formatReminderTime', () => {
  it('acepta HH:MM válidas', () => {
    expect(parseReminderTime('21:00')).toEqual({ hour: 21, minute: 0 });
    expect(parseReminderTime(' 7:45 ')).toEqual({ hour: 7, minute: 45 });
  });

  it('rechaza valores fuera de rango o malformados', () => {
    expect(parseReminderTime('24:00')).toBeNull();
    expect(parseReminderTime('21:65')).toBeNull();
    expect(parseReminderTime('9pm')).toBeNull();
  });

  it('formatea con ceros', () => {
    expect(formatReminderTime(7, 5)).toBe('07:05');
  });
});
