import { int, sqliteTable, text, real } from 'drizzle-orm/sqlite-core';

export const supplements = sqliteTable('supplements', {
  id: int('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  dose: text('dose').notNull(),
  unit: text('unit').notNull(),
  phases: text('phases').notNull().default('[]'), // JSON array of CyclePhase
  notionId: text('notion_id'),
  active: int('active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull().default(''),
  updatedAt: text('updated_at').notNull().default(''),
});

export const dailyLogs = sqliteTable('daily_logs', {
  id: int('id').primaryKey({ autoIncrement: true }),
  user: text('user').notNull().default('diana'), // 'diana' | 'estefania'
  supplementId: int('supplement_id')
    .notNull()
    .references(() => supplements.id, { onDelete: 'cascade' }),
  date: text('date').notNull(), // YYYY-MM-DD
  taken: int('taken', { mode: 'boolean' }).notNull().default(false),
  notes: text('notes'),
  createdAt: text('created_at').notNull().default(''),
});

export const stock = sqliteTable('stock', {
  id: int('id').primaryKey({ autoIncrement: true }),
  supplementId: int('supplement_id')
    .notNull()
    .unique()
    .references(() => supplements.id, { onDelete: 'cascade' }),
  quantity: real('quantity').notNull().default(0),
  unit: text('unit').notNull(),
  lastUpdated: text('last_updated').notNull().default(''),
  bottleOpenedAt: text('bottle_opened_at'),
  totalPills: real('total_pills'),
  pillsPerDay: real('pills_per_day'),
  /** Evita llamadas repetidas a Notion `markForRestock` cuando ya se marcó recompra. */
  restockFlagged: int('restock_flagged', { mode: 'boolean' }).notNull().default(false),
});

export const phases = sqliteTable('phases', {
  id: int('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(), // CyclePhase
  startDate: text('start_date').notNull(),
  endDate: text('end_date').notNull(),
  notionPageId: text('notion_page_id'),
});

export const cycleStates = sqliteTable('cycle_states', {
  id: int('id').primaryKey({ autoIncrement: true }),
  user: text('user').notNull().unique(), // 'diana' | 'estefania'
  lastPeriodStart: text('last_period_start'), // ISO date string (YYYY-MM-DD) o ISO completo
  updatedAt: text('updated_at').notNull().default(''),
});
