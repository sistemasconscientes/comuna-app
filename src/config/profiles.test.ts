import {
  MAX_PROFILES,
  __setRuntimeProfileOverridesForTests,
  getNotionPhaseRowLabel,
  getNotionSupplementPersona,
  getProfileLabel,
  getProfiles,
  isActiveProfileId,
  isProfileId,
  isSharedPersona,
  overridesFromDetectedPersonas,
  overridesFromPhaseRowLabels,
  overridesFromPersonaList,
  mergeDetectedOverrides,
  profileTracksCycle,
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

  it('compacta labels vacíos y crea un perfil por persona (más de 2)', () => {
    const o = overridesFromPhaseRowLabels(['', 'María', 'Tercera', 'Cuarta']);
    expect(o.profileCount).toBe(3);
    expect(o.profileLabels).toEqual({
      profile_1: 'María',
      profile_2: 'Tercera',
      profile_3: 'Cuarta',
    });
  });

  it('respeta el tope MAX_PROFILES', () => {
    const many = Array.from({ length: MAX_PROFILES + 3 }, (_, i) => `P${i}`);
    const o = overridesFromPhaseRowLabels(many);
    expect(o.profileCount).toBe(MAX_PROFILES);
  });
});

describe('perfiles sin ciclo y personas compartidas', () => {
  it('agrega personas sin fila de fases como perfiles sin ciclo, al final', () => {
    const o = overridesFromDetectedPersonas(['Ana', 'María'], ['Sol', 'ana', 'Compartido']);
    expect(o.profileCount).toBe(3);
    expect(o.profileLabels?.profile_3).toBe('Sol');
    expect(o.cycleByProfile).toEqual({ profile_1: true, profile_2: true, profile_3: false });
  });

  it('profileTracksCycle por defecto es true y respeta overrides', () => {
    expect(profileTracksCycle('profile_1')).toBe(true);
    __setRuntimeProfileOverridesForTests({ cycleByProfile: { profile_2: false } });
    expect(profileTracksCycle('profile_2')).toBe(false);
  });

  it('reconoce las opciones compartidas sin importar mayúsculas', () => {
    expect(isSharedPersona('Ambas')).toBe(true);
    expect(isSharedPersona('compartido')).toBe(true);
    expect(isSharedPersona('Diana')).toBe(false);
    expect(isSharedPersona('')).toBe(false);
  });

  it('getProfiles sigue a profileCount y los ids fuera de rango no están activos', () => {
    expect(getProfiles().map((p) => p.id)).toEqual(['profile_1', 'profile_2']);
    __setRuntimeProfileOverridesForTests({ profileCount: 4 });
    expect(getProfiles()).toHaveLength(4);
    expect(isActiveProfileId('profile_4')).toBe(true);
    expect(isActiveProfileId('profile_5')).toBe(false);
    expect(isProfileId('profile_0')).toBe(false);
  });

  it('perfiles sin mapeo usan su label como persona en Notion', () => {
    __setRuntimeProfileOverridesForTests({
      profileCount: 3,
      profileLabels: { profile_3: 'Sol' },
    });
    expect(getNotionSupplementPersona('profile_3')).toBe('Sol');
    expect(getNotionPhaseRowLabel('profile_3')).toBe('Sol');
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
    // Sin profileCount explícito no se inventa uno.
    expect(next.profileCount).toBeUndefined();
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

describe('orden de la tabla y reconexión', () => {
  it('respeta el orden de la tabla aunque una fila «Sin ciclo» vaya primero', () => {
    const o = overridesFromPersonaList([
      { label: 'Ana', tracksCycle: false },
      { label: 'Bea', tracksCycle: true },
      { label: 'Caro', tracksCycle: true },
    ]);
    expect(o.profileLabels).toEqual({ profile_1: 'Ana', profile_2: 'Bea', profile_3: 'Caro' });
    expect(o.cycleByProfile).toEqual({ profile_1: false, profile_2: true, profile_3: true });
  });

  it('al reconectar conserva el nombre y «Sigue ciclo» editados, emparejando por persona', () => {
    const prev = {
      profileCount: 2,
      profileLabels: { profile_1: 'Dia 🌿', profile_2: 'Este' },
      notionByProfile: {
        profile_1: { supplementPersona: 'Diana', phaseRowLabel: 'Diana' },
        profile_2: { supplementPersona: 'Estefanía', phaseRowLabel: 'Estefanía' },
      },
      cycleByProfile: { profile_2: false },
    };
    const detected = overridesFromPersonaList([
      { label: 'Estefanía', tracksCycle: true },
      { label: 'Diana', tracksCycle: true },
      { label: 'Sol', tracksCycle: false },
    ]);
    const merged = mergeDetectedOverrides(prev, detected);
    expect(merged.profileCount).toBe(3);
    // El orden lo manda Notion; el nombre y el ciclo editados viajan con la persona.
    expect(merged.profileLabels).toEqual({
      profile_1: 'Este',
      profile_2: 'Dia 🌿',
      profile_3: 'Sol',
    });
    expect(merged.cycleByProfile).toEqual({ profile_1: false, profile_2: true, profile_3: false });
  });
});
