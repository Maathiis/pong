import {
  boolean,
  integer,
  jsonb,
  pgTable,
  real,
  serial,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  pseudo: varchar('pseudo', { length: 8 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  consentAt: timestamp('consent_at', { withTimezone: true }).notNull(),
  alertOffline: boolean('alert_offline').notNull().default(true),
  alertSpeedRecord: boolean('alert_speed_record').notNull().default(true),
  /** Seuil d'alerte de vitesse de balle, en multiple de la vitesse de départ. */
  speedAlertThreshold: real('speed_alert_threshold').notNull().default(2.5),
  alertMatchPoint: boolean('alert_match_point').notNull().default(false),
  retroSounds: boolean('retro_sounds').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const bornes = pgTable('bornes', {
  id: varchar('id', { length: 32 }).primaryKey(),
  name: varchar('name', { length: 64 }),
  online: boolean('online').notNull().default(false),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type MatchStatus = 'WAITING' | 'READY' | 'COUNTDOWN' | 'LIVE' | 'FINISHED' | 'INTERRUPTED' | 'CANCELLED';
export type Side = 'left' | 'right';

/** Pseudo affiché pour le bot de la borne (réservé : aucun joueur ne peut le prendre). */
export const BOT_PSEUDO = 'BOT';

export const matches = pgTable('matches', {
  id: uuid('id').primaryKey().defaultRandom(),
  borneId: varchar('borne_id', { length: 32 })
    .notNull()
    .references(() => bornes.id),
  status: varchar('status', { length: 16 }).$type<MatchStatus>().notNull(),
  targetScore: integer('target_score').notNull().default(7),
  leftUserId: uuid('left_user_id').references(() => users.id, { onDelete: 'set null' }),
  rightUserId: uuid('right_user_id').references(() => users.id, { onDelete: 'set null' }),
  /** Partie contre le bot : la borne joue la raquette droite, rightUserId reste vide. */
  vsBot: boolean('vs_bot').notNull().default(false),
  scoreLeft: integer('score_left').notNull().default(0),
  scoreRight: integer('score_right').notNull().default(0),
  winnerSide: varchar('winner_side', { length: 5 }).$type<Side>(),
  waitingUntil: timestamp('waiting_until', { withTimezone: true }),
  countdownEndsAt: timestamp('countdown_ends_at', { withTimezone: true }),
  startedAt: timestamp('started_at', { withTimezone: true }),
  endedAt: timestamp('ended_at', { withTimezone: true }),
  maxSpeed: real('max_speed').notNull().default(0),
  maxStreak: integer('max_streak').notNull().default(0),
  longestRally: integer('longest_rally').notNull().default(0),
  totalBounces: integer('total_bounces').notNull().default(0),
  streakSide: varchar('streak_side', { length: 5 }).$type<Side>(),
  streakCount: integer('streak_count').notNull().default(0),
  endRequests: jsonb('end_requests').$type<Side[]>().notNull().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const matchEvents = pgTable('match_events', {
  id: serial('id').primaryKey(),
  matchId: uuid('match_id')
    .notNull()
    .references(() => matches.id, { onDelete: 'cascade' }),
  kind: varchar('kind', { length: 24 }).notNull(),
  text: text('text').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type Borne = typeof bornes.$inferSelect;
export type Match = typeof matches.$inferSelect;
export type MatchEvent = typeof matchEvents.$inferSelect;
