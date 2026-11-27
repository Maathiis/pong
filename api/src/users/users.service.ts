import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, inArray, or, sql } from 'drizzle-orm';
import { toPublicUser } from '../auth/auth.service.js';
import { DB, type Db } from '../db/db.module.js';
import { BOT_PSEUDO, matchEvents, matches, users, type Side, type User } from '../db/schema.js';
import { SettingsDto } from './settings.dto.js';

@Injectable()
export class UsersService {
  constructor(@Inject(DB) private readonly db: Db) {}

  me(user: User) {
    return toPublicUser(user);
  }

  async updateSettings(user: User, dto: SettingsDto) {
    const [updated] = await this.db.update(users).set(dto).where(eq(users.id, user.id)).returning();
    return toPublicUser(updated);
  }

  /** RGPD : supprime le compte. Les parties restent pour l'adversaire, sans le pseudo. */
  async remove(user: User) {
    await this.db.transaction(async (tx) => {
      // Le fil des parties cite le pseudo en toutes lettres (« NATHAN marque · 3-2 ») : on l'efface aussi.
      const played = tx
        .select({ id: matches.id })
        .from(matches)
        .where(or(eq(matches.leftUserId, user.id), eq(matches.rightUserId, user.id)));
      await tx
        .update(matchEvents)
        .set({ text: sql`replace(${matchEvents.text}, ${user.pseudo}, 'ANCIEN')` })
        .where(inArray(matchEvents.matchId, played));
      await tx.delete(users).where(eq(users.id, user.id));
    });
  }

  async stats(user: User) {
    const rows = await this.db
      .select()
      .from(matches)
      .where(
        and(
          inArray(matches.status, ['FINISHED', 'INTERRUPTED']),
          or(eq(matches.leftUserId, user.id), eq(matches.rightUserId, user.id)),
        ),
      )
      .orderBy(desc(matches.endedAt));

    const opponentIds = rows
      .map((m) => (m.leftUserId === user.id ? m.rightUserId : m.leftUserId))
      .filter((id): id is string => !!id);
    const opponents = opponentIds.length
      ? await this.db
          .select({ id: users.id, pseudo: users.pseudo })
          .from(users)
          .where(inArray(users.id, [...new Set(opponentIds)]))
      : [];

    const results = rows.map((m) => {
      const side: Side = m.leftUserId === user.id ? 'left' : 'right';
      const opponentId = side === 'left' ? m.rightUserId : m.leftUserId;
      const result = m.status !== 'FINISHED' ? null : m.winnerSide === side ? 'V' : 'D';
      return {
        id: m.id,
        result: result as 'V' | 'D' | null,
        status: m.status,
        me: user.pseudo,
        opponent: m.vsBot ? BOT_PSEUDO : (opponents.find((o) => o.id === opponentId)?.pseudo ?? 'ANCIEN'),
        scoreMe: side === 'left' ? m.scoreLeft : m.scoreRight,
        scoreOpponent: side === 'left' ? m.scoreRight : m.scoreLeft,
        endedAt: m.endedAt,
      };
    });

    const finished = results.filter((r) => r.result);
    const wins = finished.filter((r) => r.result === 'V').length;
    let streak: { result: 'V' | 'D'; count: number } | null = null;
    for (const r of finished) {
      if (!streak) streak = { result: r.result!, count: 1 };
      else if (r.result === streak.result) streak.count++;
      else break;
    }

    return {
      played: results.length,
      wins,
      losses: finished.length - wins,
      winRate: finished.length ? Math.round((wins / finished.length) * 100) : 0,
      streak,
      recent: results.slice(0, 4),
    };
  }

  /** Tableau des scores public (visible sans compte). */
  async leaderboard() {
    const res = await this.db.execute<{ pseudo: string; played: number; wins: number }>(sql`
      select u.pseudo,
             count(m.id)::int as played,
             count(m.id) filter (
               where (m.winner_side = 'left' and m.left_user_id = u.id)
                  or (m.winner_side = 'right' and m.right_user_id = u.id)
             )::int as wins
      from ${users} u
      join ${matches} m on m.status = 'FINISHED' and not m.vs_bot -- les parties contre le bot ne comptent pas au classement
                        and (m.left_user_id = u.id or m.right_user_id = u.id)
      group by u.id
      order by wins desc, played asc, u.pseudo asc
      limit 20
    `);
    return res.rows.map((r, i) => ({
      rank: i + 1,
      pseudo: r.pseudo,
      played: r.played,
      wins: r.wins,
      winRate: r.played ? Math.round((r.wins / r.played) * 100) : 0,
    }));
  }
}
