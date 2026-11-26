import { Inject, Injectable } from '@nestjs/common';
import { eq, inArray } from 'drizzle-orm';
import { DB, type Db } from '../db/db.module.js';
import { users, type User } from '../db/schema.js';
import { RealtimeGateway } from './realtime.gateway.js';

export type AlertKind = 'speed' | 'match_point' | 'borne_offline';

/** Réglage du compte qui active chaque type d'alerte. */
const SETTING: Record<
  AlertKind,
  keyof Pick<User, 'alertSpeedRecord' | 'alertMatchPoint' | 'alertOffline'>
> = {
  speed: 'alertSpeedRecord',
  match_point: 'alertMatchPoint',
  borne_offline: 'alertOffline',
};

/**
 * Alertes envoyées aux applis connectées (événement Socket.IO `alert`), selon les réglages de chaque joueur.
 * L'appli les affiche en bannière, avec vibration et son.
 */
@Injectable()
export class AlertsService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly realtime: RealtimeGateway,
  ) {}

  /**
   * @param userIds destinataires possibles (null = tous les comptes)
   * @param body texte de l'alerte, ou fonction qui le calcule pour chaque joueur (null = pas d'alerte pour lui)
   */
  async send(
    kind: AlertKind,
    userIds: (string | null)[] | null,
    title: string,
    body: string | ((u: User) => string | null),
  ) {
    const ids = userIds?.filter((id): id is string => !!id);
    if (ids && ids.length === 0) return;
    const rows = await this.db
      .select()
      .from(users)
      .where(ids ? inArray(users.id, ids) : eq(users[SETTING[kind]], true));
    const at = new Date().toISOString();
    for (const u of rows) {
      if (!u[SETTING[kind]]) continue;
      const text = typeof body === 'function' ? body(u) : body;
      if (text)
        this.realtime.toUsers([u.id], 'alert', { kind, title, body: text, at });
    }
  }
}
