import {
  __setRuntimeProfileOverridesForTests,
  getNotionPhaseRowLabel,
  getNotionSupplementPersona,
  getProfileLabel,
  overridesFromPhaseRowLabels,
  subscribeProfileOverrides,
  sanitizeProfileOverrides,
} from './profiles';

afterEach(() => {
  __setRuntimeProfileOverridesForTests({});
});

describe('overrides runtime de perfiles', () => {
  it('sin overrides usa los defaults (labels genéricos, mapeo Notion del template)', () => {
    expect(getProfileLabel('profile_1')).toBe('Perfil 1');
    expect(getNotionSupplementPersona('profile_2')).toBe('Estefanía');
    expect(getNotionPhaseRowLabel('profile_2')).toBe('Estefanía');
  });

  it('los overrides runtime pisan defaults en label, persona y fila de fases', () => {
    __setRuntimeProfileOverridesForTests({
      profileLabels: { profile_1: 'Ana' },
      notionByProfile: { profile_1: { supplementPersona: 'Ana', phaseRowLabel: 'Ana' } },
    });
    expect(getProfileLabel('profile_1')).toBe('Ana');
    expect(getNotionSupplementPersona('profile_1')).toBe('Ana');
    expect(getNotionPhaseRowLabel('profile_1')).toBe('Ana');
    // El slot sin override conserva sus defaults.
    expect(getProfileLabel('profile_2')).toBe('Perfil 2');
  });

  it('notifica a los suscriptores al cambiar overrides', () => {
    const seen = jest.fn();
    const unsubscribe = subscribeProfileOverrides(seen);
    __setRuntimeProfileOverridesForTests({ profileLabels: { profile_1: 'Ana' } });
    expect(seen).toHaveBeenCalledTimes(1);
    unsubscribe();
    __setRuntimeProfileOverridesForTests({});
    expect(seen).toHaveBeenCalledTimes(1);
  });
});

describe('overridesFromPhaseRowLabels', () => {
  it('mapea filas detectadas a slots en orden', () => {
    const o = overridesFromPhaseRowLabels(['Ana', 'María']);
    expect(o.profileLabels).toEqual({ profile_1: 'Ana', profile_2: 'María' });
    expect(o.notionByProfile?.profile_2).toEqual({
      supplementPersona: 'María',
      phaseRowLabel: 'María',
    });
  });

  it('con una sola fila deja el segundo slot sin override', () => {
    const o = overridesFromPhaseRowLabels(['Ana']);
    expect(o.profileLabels).toEqual({ profile_1: 'Ana' });
    expect(o.notionByProfile?.profile_2).toBeUndefined();
  });

  it('compacta labels vacíos y descarta filas extra más allá de los slots', () => {
    const o = overridesFromPhaseRowLabels(['', 'María', 'Tercera', 'Cuarta']);
    expect(o.profileLabels).toEqual({ profile_1: 'María', profile_2: 'Tercera' });
  });
});

describe('sanitizeProfileOverrides', () => {
  it('descarta el slot mapeado a palabra de encabezado y recorre el resto', () => {
    const { next, changed } = sanitizeProfileOverrides({
      profileLabels: { profile_1: 'Persona', profile_2: 'Diana' },
      notionByProfile: {
        profile_1: { supplementPersona: 'Persona', phaseRowLabel: 'Persona' },
        profile_2: { supplementPersona: 'Diana', phaseRowLabel: 'Diana' },
      },
    });
    expect(changed).toBe(true);
    expect(next.profileLabels).toEqual({ profile_1: 'Diana' });
    expect(next.notionByProfile?.profile_1).toEqual({
      supplementPersona: 'Diana',
      phaseRowLabel: 'Diana',
    });
    expect(next.notionByProfile?.profile_2).toBeUndefined();
  });

  it('no toca overrides sanos', () => {
    const clean = {
      profileLabels: { profile_1: 'Ana', profile_2: 'María' },
      notionByProfile: { profile_1: { supplementPersona: 'Ana', phaseRowLabel: 'Ana' } },
    };
    const { next, changed } = sanitizeProfileOverrides(clean);
    expect(changed).toBe(false);
    expect(next).toBe(clean);
  });
});

describe('overridesFromPhaseRowLabels con encabezados residuales', () => {
  it('filtra palabras de header aunque lleguen del detector', () => {
    const o = overridesFromPhaseRowLabels(['Persona', 'Diana', 'Estefanía']);
    expect(o.profileLabels).toEqual({ profile_1: 'Diana', profile_2: 'Estefanía' });
  });
});
