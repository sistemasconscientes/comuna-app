import {
  addDaysISO,
  compareISODates,
  formatDateLabelES,
  localTodayISO,
} from './useSelectableLogDate';

describe('addDaysISO', () => {
  it('resta un día', () => {
    expect(addDaysISO('2024-03-02', -1)).toBe('2024-03-01');
  });

  it('suma un día', () => {
    expect(addDaysISO('2024-02-28', 1)).toBe('2024-02-29');
  });
});

describe('compareISODates', () => {
  it('ordena lexicográficamente como calendario', () => {
    expect(compareISODates('2024-01-01', '2024-01-02')).toBe(-1);
    expect(compareISODates('2024-01-02', '2024-01-02')).toBe(0);
    expect(compareISODates('2024-02-01', '2024-01-01')).toBe(1);
  });
});

describe('localTodayISO', () => {
  it('tiene forma YYYY-MM-DD', () => {
    expect(localTodayISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('formatDateLabelES', () => {
  it('incluye año y mes', () => {
    const s = formatDateLabelES('2024-03-15');
    expect(s).toMatch(/2024/);
    expect(s.length).toBeGreaterThan(8);
  });
});
