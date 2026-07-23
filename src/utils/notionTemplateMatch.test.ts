import { matchNotionTemplate } from './notionTemplateMatch';

describe('matchNotionTemplate', () => {
  it('encuentra DB de suplementos por prefijo de token, con y sin sufijos', () => {
    const m = matchNotionTemplate(
      [
        { id: 'db-extra', title: 'Suplementos archivados 2024' },
        { id: 'db-sup', title: 'Suplementos' },
      ],
      [],
    );
    expect(m.supplementsDbId).toBe('db-sup');
  });

  it('encuentra la BD de Tés sin confundirla con "Template"', () => {
    const m = matchNotionTemplate(
      [
        { id: 'db-tpl', title: 'Template de prueba' },
        { id: 'db-teas', title: 'Tés' },
      ],
      [],
    );
    expect(m.teasDbId).toBe('db-teas');
  });

  it('ignora acentos y mayúsculas en el matching', () => {
    const m = matchNotionTemplate(
      [{ id: 'db-1', title: 'SUPLEMENTOS' }],
      [{ id: 'pg-1', title: 'Fases del Ciclo' }],
    );
    expect(m.supplementsDbId).toBe('db-1');
    expect(m.phasesPageCandidates).toEqual([{ id: 'pg-1', title: 'Fases del Ciclo' }]);
  });

  it('lista candidatas de comidas por "comida" o "cocina"', () => {
    const m = matchNotionTemplate(
      [],
      [
        { id: 'pg-a', title: 'Cocina y Comida' },
        { id: 'pg-b', title: 'Meal prep' },
        { id: 'pg-c', title: 'Comidas Activas' },
      ],
    );
    expect(m.mealPrepHubCandidates.map((p) => p.id)).toEqual(['pg-a', 'pg-c']);
  });

  it('devuelve vacíos cuando no hay match', () => {
    const m = matchNotionTemplate([{ id: 'db-x', title: 'Finanzas' }], []);
    expect(m.supplementsDbId).toBe('');
    expect(m.teasDbId).toBe('');
    expect(m.phasesPageCandidates).toEqual([]);
  });
});
