import {
  filterSupplementsByCurrentTemporada,
  supplementMatchesCurrentTemporada,
} from './temporadaFilter';

describe('supplementMatchesCurrentTemporada', () => {
  it('incluye Todo el año', () => {
    expect(supplementMatchesCurrentTemporada(['Todo el año'], 7, '')).toBe(true);
  });

  it('incluye Q2 en abril', () => {
    expect(supplementMatchesCurrentTemporada(['Q2'], 4, '')).toBe(true);
    expect(supplementMatchesCurrentTemporada(['Q2'], 3, '')).toBe(false);
  });

  it('incluye Fase folicular solo si la fase es folicular', () => {
    expect(supplementMatchesCurrentTemporada(['Fase folicular'], 1, 'folicular')).toBe(true);
    expect(supplementMatchesCurrentTemporada(['Fase folicular'], 1, 'lutea')).toBe(false);
  });
});

describe('filterSupplementsByCurrentTemporada', () => {
  const originalDate = Date;

  afterEach(() => {
    global.Date = originalDate;
  });

  it('filtra por mes local (mock octubre → Q4)', () => {
    global.Date = class extends Date {
      constructor(...args: unknown[]) {
        if (args.length === 0) {
          super(2025, 9, 15);
        } else {
          super(...(args as ConstructorParameters<typeof Date>));
        }
      }
    } as DateConstructor;

    const items = [
      { id: 1, temporadaLabels: ['Q3'] },
      { id: 2, temporadaLabels: ['Q4'] },
    ];
    const out = filterSupplementsByCurrentTemporada(items, '');
    expect(out.map((x) => x.id)).toEqual([2]);
  });
});
