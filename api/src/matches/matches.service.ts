import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { and, desc, eq, inArray, or } from 'drizzle-orm';
import { randomInt } from 'node:crypto';
import { BornesService } from '../bornes/bornes.service.js';
import { DB, type Db } from '../db/db.module.js';
import {
  BOT_PSEUDO,
  matchEvents,
  matches,
  users,
  type Match,
  type MatchStatus,
  type Side,
  type User,
} from '../db/schema.js';
import { MqttService } from '../mqtt/mqtt.service.js';
import { AlertsService } from '../realtime/alerts.service.js';
import { RealtimeGateway } from '../realtime/realtime.gateway.js';

const ACTIVE: MatchStatus[] = ['WAITING', 'READY', 'COUNTDOWN', 'LIVE'];
const WAITING_MS = 2 * 60_000; // une salle sans activité se ferme au bout de 2 min
const COUNTDOWN_S = 5;
/**
 * Borne hors ligne pendant une partie : elle continue en local et renvoie ses buts à la reconnexion.
 * Le broker annonce « offline » ~22 s après la coupure (1,5 × keepalive) ; on attend encore 90 s
 * avant de noter la partie « interrompue » (Wi-Fi 3-5 s + TLS 1-3 s, plus un partage de connexion qui redémarre).
 */
/** Manette du téléphone : au plus 30 commandes par seconde et par joueur (l'appli en envoie ~7 en appui long). */
const PAD_MIN_INTERVAL_MS = 33;
const OFFLINE_GRACE_MS = Number(process.env.OFFLINE_GRACE_S ?? 90) * 1000;
const TARGET_SCORE = Number(process.env.TARGET_SCORE ?? 7);

const num = (v: unknown) =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0;
const speed = (v: number) => `x${v.toFixed(1).replace('.', ',')}`;

/**
 * QR code affiché sur la matrice de la borne : « PONG: » + 8 caractères tirés au hasard.
 * Alphabet sans 0/O ni 1/I (lisible si on le recopie) et compatible avec le mode « alphanumérique » des QR codes :
 * 13 caractères tiennent dans un QR version 1 (21 × 21 modules), qui rentre dans la matrice 24 × 24.
 */
const CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const CODE_TTL_MS = 5 * 60_000; // un QR affiché change toutes les 5 min, et à chaque joueur qui rejoint
export function newJoinCode(): string {
  let out = 'PONG:';
  for (let i = 0; i < 8; i++)
    out += CODE_ALPHABET.charAt(randomInt(CODE_ALPHABET.length));
  return out;
}
export function normalizeJoinCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const code = raw.trim().toUpperCase();
  return /^PONG:[2-9A-HJ-NP-Z]{8}$/.test(code) ? code : null;
}

export type MatchDto = Awaited<ReturnType<MatchesService['toDto']>>;

@Injectable()
export class MatchesService implements OnModuleInit {
  private readonly logger = new Logger('Matches');
  private readonly locks = new Map<string, Promise<unknown>>();
  private readonly timers = new Map<string, NodeJS.Timeout>();
  /** QR code affiché par chaque borne (borne → code) et l'inverse (code → borne). */
  private readonly codeOfBorne = new Map<string, string>();
  private readonly borneOfCode = new Map<string, string>();
  /**
   * Dernier numéro de but (« seq ») reçu pour chaque partie en cours : un goal renvoyé après une coupure
   * (QoS 1) porte le même seq et doit être ignoré. En mémoire suffit : un redémarrage de l'API interrompt les parties.
   */
  private readonly lastGoalSeq = new Map<string, number>();
  /**
   * Joueurs qui jouent avec la manette du téléphone, pendant la partie (userId → partie, borne).
   * En mémoire : la manette envoie plusieurs messages par seconde, pas question d'interroger la base à chaque fois.
   */
  private readonly remotes = new Map<
    string,
    {
      matchId: string;
      borneId: string;
      side: Side;
      lastAt: number;
      lastDir: number;
    }
  >();

  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly mqtt: MqttService,
    private readonly bornes: BornesService,
    private readonly realtime: RealtimeGateway,
    private readonly alerts: AlertsService,
  ) {}

  async onModuleInit() {
    await this.recoverAfterRestart();
    this.mqtt.onStatus((borneId, online) =>
      this.lock(borneId, () =>
        online ? this.onBorneOnline(borneId) : this.onBorneOffline(borneId),
      ),
    );
    this.mqtt.onEvent((borneId, event) => {
      // accusé de réception de la manette : hors verrou et sans base, c'est la mesure de latence
      if (event.type === 'pad_ack') return this.onPadAck(borneId, event);
      return this.lock(borneId, () => this.onBorneEvent(borneId, event));
    });
    this.realtime.onPad((userId, dir, n) => this.onPad(userId, dir, n));
  }

  // ───────────────────────────── QR code de la borne ─────────────────────────────

  /**
   * Met à jour le QR code affiché par la borne : un code neuf tant qu'il reste une place
   * (pas de partie, ou un seul joueur), rien dès que la salle est complète ou que la partie a commencé.
   * Un code ne sert qu'une fois : il change à chaque joueur qui rejoint, et au bout de 5 min.
   * À appeler sous le verrou de la borne.
   */
  private async syncCode(borneId: string) {
    const [borne] = await this.bornes
      .list()
      .then((all) => all.filter((b) => b.id === borneId));
    const [open] = await this.db
      .select()
      .from(matches)
      .where(
        and(eq(matches.borneId, borneId), inArray(matches.status, ACTIVE)),
      );
    this.dropCode(borneId);
    if (!borne?.online || (open && open.status !== 'WAITING')) {
      this.mqtt.command(borneId, { type: 'qr', code: null });
      return;
    }
    const code = newJoinCode();
    this.codeOfBorne.set(borneId, code);
    this.borneOfCode.set(code, borneId);
    this.mqtt.command(borneId, { type: 'qr', code });
    this.schedule(`qr:${borneId}`, CODE_TTL_MS, () =>
      this.lock(borneId, () => this.syncCode(borneId)),
    );
  }

  private dropCode(borneId: string) {
    const old = this.codeOfBorne.get(borneId);
    if (old) this.borneOfCode.delete(old);
    this.codeOfBorne.delete(borneId);
    this.clearTimer(`qr:${borneId}`);
  }

  // ───────────────────────────── Actions des joueurs ─────────────────────────────

  /** Le joueur a scanné le QR code affiché sur la matrice de la borne. */
  async joinByCode(user: User, raw: string) {
    const code = normalizeJoinCode(raw);
    if (!code)
      throw new BadRequestException(
        "Ce QR code n'est pas celui d'une borne Pong.",
      );
    const borneId = this.borneOfCode.get(code);
    if (!borneId)
      throw new NotFoundException(
        'QR code expiré : scanne celui qui est affiché sur la borne maintenant.',
      );
    return this.lock(borneId, async () => {
      if (this.codeOfBorne.get(borneId) !== code) {
        throw new NotFoundException(
          'QR code expiré : scanne celui qui est affiché sur la borne maintenant.',
        );
      }
      let [open] = await this.db
        .select()
        .from(matches)
        .where(
          and(eq(matches.borneId, borneId), inArray(matches.status, ACTIVE)),
        );
      if (!open) {
        const mine = await this.activeMatchOf(user.id);
        if (mine)
          throw new ConflictException(
            `Tu es déjà dans une partie sur ${mine.borneId}.`,
          );
        [open] = await this.db
          .insert(matches)
          .values({
            borneId,
            status: 'WAITING',
            targetScore: TARGET_SCORE,
            waitingUntil: new Date(Date.now() + WAITING_MS),
          })
          .returning();
      }
      return this.addPlayer(user, open);
    });
  }

  /** Place le joueur à gauche s'il est le premier, à droite sinon. À appeler sous le verrou de la borne. */
  private async addPlayer(user: User, match: Match) {
    if (match.leftUserId === user.id || match.rightUserId === user.id)
      return this.toDto(match);

    const mine = await this.activeMatchOf(user.id);
    if (mine)
      throw new ConflictException(
        `Tu es déjà dans une partie sur ${mine.borneId}.`,
      );
    if (match.status !== 'WAITING')
      throw new ConflictException('La partie est déjà complète.');

    const side: Side = match.leftUserId ? 'right' : 'left';
    const full = side === 'right';
    const [updated] = await this.db
      .update(matches)
      .set({
        ...(side === 'left'
          ? { leftUserId: user.id }
          : { rightUserId: user.id }),
        status: full ? 'READY' : 'WAITING',
        startRequests: [], // nouveau joueur : chacun doit (re)confirmer qu'il est prêt
        waitingUntil: new Date(Date.now() + WAITING_MS),
      })
      .where(eq(matches.id, match.id))
      .returning();
    this.schedule(updated.id, WAITING_MS, () =>
      this.expireWaiting(updated.borneId, updated.id),
    );
    await this.sendLobby(updated);
    await this.syncCode(updated.borneId); // code neuf pour le joueur 2, ou plus de code si la salle est complète
    await this.log(
      updated.id,
      'join',
      `${user.pseudo} rejoint (${side === 'left' ? 'gauche' : 'droite'})`,
    );
    return this.publish(updated);
  }

  /**
   * « Je suis prêt » : la partie démarre quand les deux joueurs l'ont demandé (contre le bot, le joueur seul suffit).
   * Personne ne se fait lancer une partie dessus alors qu'il n'est pas devant sa raquette.
   */
  async start(user: User, matchId: string) {
    const match = await this.getOwn(user, matchId);
    return this.lock(match.borneId, async () => {
      const fresh = await this.getOwn(user, matchId);
      if (fresh.status !== 'READY')
        throw new ConflictException(
          'Il faut deux joueurs (ou le bot) pour lancer la partie.',
        );
      const side: Side = fresh.leftUserId === user.id ? 'left' : 'right';
      const requests = Array.from(new Set([...fresh.startRequests, side]));
      if (!fresh.vsBot && requests.length < 2) {
        const [waiting] = await this.db
          .update(matches)
          .set({
            startRequests: requests,
            waitingUntil: new Date(Date.now() + WAITING_MS),
          })
          .where(eq(matches.id, fresh.id))
          .returning();
        this.schedule(waiting.id, WAITING_MS, () =>
          this.expireWaiting(waiting.borneId, waiting.id),
        );
        await this.log(waiting.id, 'ready', `${user.pseudo} est prêt`);
        return this.publish(waiting);
      }
      const [updated] = await this.db
        .update(matches)
        .set({
          status: 'COUNTDOWN',
          startRequests: requests,
          waitingUntil: null,
          countdownEndsAt: new Date(Date.now() + COUNTDOWN_S * 1000),
          remoteSide: this.remoteSide(fresh), // gardé pour l'historique (la règle peut changer plus tard)
        })
        .where(eq(matches.id, fresh.id))
        .returning();
      const p = await this.pseudos(updated);
      this.mqtt.command(updated.borneId, {
        type: 'start',
        matchId: updated.id,
        countdown: COUNTDOWN_S,
        targetScore: updated.targetScore,
        left: p.left,
        right: p.right,
        bot: updated.vsBot ? 'right' : null, // raquette jouée par la borne elle-même
        remote: this.remoteSide(updated), // raquette jouée avec la manette du téléphone
      });
      const remote = this.remoteSide(updated);
      const remoteUser = remote === 'right' ? updated.rightUserId : null;
      if (remote && remoteUser) {
        this.remotes.set(remoteUser, {
          matchId: updated.id,
          borneId: updated.borneId,
          side: remote,
          lastAt: 0,
          lastDir: 0,
        });
      }
      this.schedule(updated.id, COUNTDOWN_S * 1000, () =>
        this.goLive(updated.borneId, updated.id),
      );
      await this.log(
        updated.id,
        'start',
        updated.vsBot
          ? `${user.pseudo} lance la partie contre le bot`
          : `Les deux joueurs sont prêts : ${p.left} contre ${p.right}`,
      );
      return this.publish(updated);
    });
  }

  /**
   * « Jouer contre le bot » : le joueur seul dans la salle prend le bot comme adversaire.
   * La salle est complète (plus de QR code), la partie se lance ensuite comme d'habitude.
   */
  async playBot(user: User, matchId: string) {
    const match = await this.getOwn(user, matchId);
    return this.lock(match.borneId, async () => {
      const fresh = await this.getOwn(user, matchId);
      if (fresh.status !== 'WAITING' || fresh.rightUserId) {
        throw new ConflictException(
          'Le bot ne peut remplacer que le joueur 2, avant le lancement.',
        );
      }
      const [updated] = await this.db
        .update(matches)
        .set({
          vsBot: true,
          status: 'READY',
          waitingUntil: new Date(Date.now() + WAITING_MS),
        })
        .where(eq(matches.id, fresh.id))
        .returning();
      this.schedule(updated.id, WAITING_MS, () =>
        this.expireWaiting(updated.borneId, updated.id),
      );
      await this.sendLobby(updated);
      await this.syncCode(updated.borneId); // salle complète : la borne efface le QR code
      await this.log(updated.id, 'bot', `${user.pseudo} joue contre le bot`);
      return this.publish(updated);
    });
  }

  /** « Quitter la salle » : avant le lancement uniquement. */
  async leave(user: User, matchId: string) {
    const match = await this.getOwn(user, matchId);
    return this.lock(match.borneId, async () => {
      const fresh = await this.getOwn(user, matchId);
      if (fresh.status !== 'WAITING' && fresh.status !== 'READY') {
        throw new ConflictException('La partie a déjà commencé.');
      }
      return this.removePlayer(fresh, user);
    });
  }

  private async removePlayer(match: Match, user: User) {
    if (match.vsBot) {
      // contre le bot, le joueur est seul : s'il part, la salle ferme
      return this.finish(
        match,
        'CANCELLED',
        null,
        `${user.pseudo} a quitté la salle`,
      );
    }
    const left = match.leftUserId === user.id ? null : match.leftUserId;
    const right = match.rightUserId === user.id ? null : match.rightUserId;
    // Celui qui reste passe à gauche, pour que « joueur 1 » soit toujours rempli en premier.
    const nextLeft = left ?? right;
    const nextRight = left ? right : null;
    if (!nextLeft) {
      return this.finish(
        match,
        'CANCELLED',
        null,
        `${user.pseudo} a quitté la salle`,
      );
    }
    const [updated] = await this.db
      .update(matches)
      .set({
        leftUserId: nextLeft,
        rightUserId: nextRight,
        status: 'WAITING',
        startRequests: [],
      })
      .where(eq(matches.id, match.id))
      .returning();
    await this.sendLobby(updated);
    await this.syncCode(updated.borneId); // une place s'est libérée : la borne réaffiche un QR code
    await this.log(updated.id, 'leave', `${user.pseudo} a quitté la salle`);
    // le joueur parti reçoit aussi la mise à jour, pour que son appli revienne à l'écran de scan
    this.realtime.toUsers([user.id], 'match:left', { id: updated.id });
    return this.publish(updated);
  }

  private async sendLobby(match: Match) {
    const p = await this.pseudos(match);
    this.mqtt.command(match.borneId, {
      type: 'lobby',
      left: match.leftUserId ? p.left : null,
      right: match.rightUserId || match.vsBot ? p.right : null,
      ready: match.status === 'READY',
      bot: match.vsBot ? 'right' : null,
    });
  }

  /** « Fin du match » : la partie s'arrête quand les deux joueurs l'ont demandé. */
  async requestEnd(user: User, matchId: string) {
    const match = await this.getOwn(user, matchId);
    return this.lock(match.borneId, async () => {
      const fresh = await this.getOwn(user, matchId);
      if (fresh.status === 'WAITING' || fresh.status === 'READY') {
        return this.removePlayer(fresh, user);
      }
      if (fresh.status !== 'LIVE' && fresh.status !== 'COUNTDOWN') {
        throw new ConflictException('Cette partie est déjà terminée.');
      }
      const side: Side = fresh.leftUserId === user.id ? 'left' : 'right';
      const requests = Array.from(new Set([...fresh.endRequests, side]));
      if (requests.length === 2 || fresh.vsBot) {
        return this.finish(
          { ...fresh, endRequests: requests },
          'INTERRUPTED',
          null,
          fresh.vsBot
            ? `${user.pseudo} arrête la partie`
            : 'Fin demandée par les deux joueurs',
        );
      }
      const [updated] = await this.db
        .update(matches)
        .set({ endRequests: requests })
        .where(eq(matches.id, fresh.id))
        .returning();
      await this.log(fresh.id, 'end_request', `${user.pseudo} demande la fin`);
      return this.publish(updated);
    });
  }

  async current(user: User) {
    const match = await this.activeMatchOf(user.id);
    return match ? this.toDto(match) : null;
  }

  /** Détail d'une partie : réservé à ses joueurs (R7). */
  async get(user: User, matchId: string) {
    const match = await this.getOwn(user, matchId);
    return this.toDto(match, 1000); // détail (historique) : tout le fil ; 1000 = garde-fou, une partie en compte quelques dizaines
  }

  // ───────────────────────────── Messages de la borne ─────────────────────────────

  private async onBorneEvent(borneId: string, event: Record<string, unknown>) {
    const matchId = typeof event.matchId === 'string' ? event.matchId : null;
    const [match] = matchId
      ? await this.db
          .select()
          .from(matches)
          .where(and(eq(matches.id, matchId), eq(matches.borneId, borneId)))
      : [];
    if (!match || (match.status !== 'LIVE' && match.status !== 'COUNTDOWN')) {
      this.logger.warn(
        `Événement ignoré de ${borneId} (pas de partie en cours pour ${matchId}) : ${JSON.stringify(event)}`,
      );
      return;
    }

    switch (event.type) {
      case 'goal':
        return this.onGoal(match, event);
      case 'abort':
        return this.finish(
          match,
          'INTERRUPTED',
          null,
          'Partie coupée depuis la borne',
        );
      default:
        this.logger.warn(
          `Type d'événement inconnu de ${borneId} : ${String(event.type)}`,
        );
    }
  }

  private async onGoal(match: Match, event: Record<string, unknown>) {
    const side = event.side;
    if (side !== 'left' && side !== 'right') {
      this.logger.warn(
        `But ignoré, « side » doit valoir left ou right : ${JSON.stringify(event)}`,
      );
      return;
    }
    // « seq » facultatif (1, 2, 3… par partie) : sans lui, chaque goal compte, comme avant.
    if (typeof event.seq === 'number' && Number.isInteger(event.seq)) {
      if (event.seq <= (this.lastGoalSeq.get(match.id) ?? 0)) {
        this.logger.warn(
          `But en double ignoré (seq ${event.seq}) : ${JSON.stringify(event)}`,
        );
        return;
      }
      this.lastGoalSeq.set(match.id, event.seq);
    }
    const rallyHits = Math.round(num(event.rallyHits));
    const bounces = Math.round(num(event.bounces));
    const maxSpeed = num(event.maxSpeed);

    const scoreLeft = match.scoreLeft + (side === 'left' ? 1 : 0);
    const scoreRight = match.scoreRight + (side === 'right' ? 1 : 0);
    const streakCount = match.streakSide === side ? match.streakCount + 1 : 1;
    const speedRecord = maxSpeed > match.maxSpeed && match.maxSpeed > 0;

    const [updated] = await this.db
      .update(matches)
      .set({
        status: 'LIVE',
        startedAt: match.startedAt ?? new Date(),
        scoreLeft,
        scoreRight,
        streakSide: side,
        streakCount,
        maxStreak: Math.max(match.maxStreak, streakCount),
        longestRally: Math.max(match.longestRally, rallyHits),
        totalBounces: match.totalBounces + bounces,
        maxSpeed: Math.max(match.maxSpeed, maxSpeed),
      })
      .where(eq(matches.id, match.id))
      .returning();
    this.clearTimer(match.id);

    const pseudos = await this.pseudos(updated);
    await this.log(
      match.id,
      'goal',
      `${pseudos[side]} marque · ${scoreLeft}-${scoreRight}`,
    );
    if (speedRecord)
      await this.log(
        match.id,
        'speed_record',
        `Record de vitesse : ${speed(maxSpeed)}`,
      );

    // Alerte de seuil : chaque joueur choisit sa vitesse limite dans ses réglages.
    const players = [updated.leftUserId, updated.rightUserId];
    if (maxSpeed > 0) {
      await this.alerts.send(
        'speed',
        players,
        `Balle à ${speed(maxSpeed)} !`,
        (u) =>
          maxSpeed >= u.speedAlertThreshold
            ? `Ton seuil de ${speed(u.speedAlertThreshold)} est dépassé.`
            : null,
      );
    }

    const target = updated.targetScore;
    if (scoreLeft >= target || scoreRight >= target) {
      const winner: Side = scoreLeft >= target ? 'left' : 'right';
      return this.finish(
        updated,
        'FINISHED',
        winner,
        `Victoire de ${pseudos[winner]}`,
      );
    }
    const matchPoint = this.matchPoint(updated);
    if (matchPoint && this.matchPoint(match) !== matchPoint) {
      await this.log(
        match.id,
        'match_point',
        `Balle de match pour ${pseudos[matchPoint]}`,
      );
      await this.alerts.send(
        'match_point',
        players,
        'Balle de match !',
        `${pseudos[matchPoint]} n'est plus qu'à un point.`,
      );
    }
    this.mqtt.command(match.borneId, {
      type: 'score',
      matchId: match.id,
      left: scoreLeft,
      right: scoreRight,
      matchPoint,
    });
    return this.publish(updated);
  }

  /** La borne revient : on annule l'attente d'une partie en cours, et on lui renvoie l'état du QR code. */
  private async onBorneOnline(borneId: string) {
    if (this.timers.has(`offline:${borneId}`)) {
      this.clearTimer(`offline:${borneId}`);
      const [match] = await this.db
        .select()
        .from(matches)
        .where(
          and(eq(matches.borneId, borneId), inArray(matches.status, ACTIVE)),
        );
      if (match) {
        await this.log(
          match.id,
          'borne_online',
          'Borne reconnectée, la partie continue',
        );
        await this.publish(match);
      }
    }
    return this.syncCode(borneId);
  }

  /**
   * Borne hors ligne : une salle d'attente est fermée tout de suite ; une partie lancée attend
   * OFFLINE_GRACE_MS que la borne revienne (elle joue en local et renvoie ses buts), puis est notée « interrompue ».
   */
  private async onBorneOffline(borneId: string) {
    this.dropCode(borneId);
    const active = await this.db
      .select()
      .from(matches)
      .where(
        and(eq(matches.borneId, borneId), inArray(matches.status, ACTIVE)),
      );
    for (const match of active) {
      if (match.status === 'WAITING' || match.status === 'READY') {
        await this.finish(match, 'CANCELLED', null, 'Borne hors ligne', false);
        continue;
      }
      await this.log(
        match.id,
        'borne_offline',
        'Borne hors ligne, attente de reconnexion',
      );
      await this.publish(match);
      this.schedule(`offline:${borneId}`, OFFLINE_GRACE_MS, () =>
        this.lock(borneId, async () => {
          const [fresh] = await this.db
            .select()
            .from(matches)
            .where(eq(matches.id, match.id));
          if (fresh?.status !== 'LIVE' && fresh?.status !== 'COUNTDOWN') return;
          return this.finish(
            fresh,
            'INTERRUPTED',
            null,
            'Borne hors ligne trop longtemps',
            false,
          );
        }),
      );
    }
  }

  // ───────────────────────────── Manette du téléphone ─────────────────────────────

  /**
   * La borne n'a des boutons que pour le joueur 1 (gauche) : un joueur 2 humain joue avec son téléphone.
   * Contre le bot, la raquette droite est jouée par la borne, il n'y a pas de manette.
   */
  private remoteSide(match: Match): Side | null {
    // partie lancée : la valeur fixée au lancement (null pour les parties d'avant la manette)
    if (match.status !== 'WAITING' && match.status !== 'READY')
      return match.remoteSide ?? null;
    return match.rightUserId && !match.vsBot ? 'right' : null;
  }

  /** Commande de manette (Socket.IO `pad`) : relayée telle quelle à la borne, en QoS 0 (une commande en retard ne sert à rien). */
  private onPad(userId: string, dir: number, n: number) {
    const remote = this.remotes.get(userId);
    if (!remote) return; // pas de partie en cours avec manette : ignoré
    const now = Date.now();
    // Seules les répétitions de la même direction sont limitées : « je lâche » et un changement de sens passent toujours.
    if (dir === remote.lastDir && now - remote.lastAt < PAD_MIN_INTERVAL_MS)
      return;
    remote.lastAt = now;
    remote.lastDir = dir;
    this.mqtt.command(
      remote.borneId,
      { type: 'pad', matchId: remote.matchId, side: remote.side, dir, n },
      0,
    );
  }

  /** La borne a reçu la commande n : on prévient le téléphone, qui en déduit l'aller-retour complet. */
  private onPadAck(borneId: string, event: Record<string, unknown>) {
    if (typeof event.n !== 'number') return;
    for (const [userId, r] of this.remotes) {
      if (r.borneId === borneId && r.matchId === event.matchId) {
        this.realtime.toUsers([userId], 'pad:ack', { n: event.n });
      }
    }
  }

  // ───────────────────────────── Transitions internes ─────────────────────────────

  private goLive(borneId: string, matchId: string) {
    return this.lock(borneId, async () => {
      const [match] = await this.db
        .select()
        .from(matches)
        .where(eq(matches.id, matchId));
      if (match?.status !== 'COUNTDOWN') return;
      const [updated] = await this.db
        .update(matches)
        .set({ status: 'LIVE', startedAt: new Date() })
        .where(eq(matches.id, matchId))
        .returning();
      return this.publish(updated);
    });
  }

  private expireWaiting(borneId: string, matchId: string) {
    return this.lock(borneId, async () => {
      const [match] = await this.db
        .select()
        .from(matches)
        .where(eq(matches.id, matchId));
      if (match?.status !== 'WAITING' && match?.status !== 'READY') return;
      return this.finish(
        match,
        'CANCELLED',
        null,
        'Salle fermée faute d’activité',
      );
    });
  }

  private async finish(
    match: Match,
    status: MatchStatus,
    winner: Side | null,
    text: string,
    notifyBorne = true,
  ) {
    this.clearTimer(match.id);
    this.clearTimer(`offline:${match.borneId}`);
    this.lastGoalSeq.delete(match.id);
    for (const [userId, r] of this.remotes)
      if (r.matchId === match.id) this.remotes.delete(userId);
    const [updated] = await this.db
      .update(matches)
      .set({
        status,
        winnerSide: winner,
        endedAt: new Date(),
        endRequests: match.endRequests,
      })
      .where(eq(matches.id, match.id))
      .returning();
    if (notifyBorne) {
      const reason =
        status === 'FINISHED'
          ? 'finished'
          : status === 'INTERRUPTED'
            ? 'interrupted'
            : 'cancelled';
      this.mqtt.command(match.borneId, {
        type: 'stop',
        matchId: match.id,
        reason,
        winner,
      });
    }
    await this.log(match.id, status.toLowerCase(), text);
    const dto = await this.publish(updated);
    if (notifyBorne) await this.syncCode(match.borneId); // la borne est libre : nouveau QR code
    return dto;
  }

  /** Au démarrage de l'API, les parties restées ouvertes ne peuvent plus continuer proprement. */
  private async recoverAfterRestart() {
    const stale = await this.db
      .select()
      .from(matches)
      .where(inArray(matches.status, ACTIVE));
    for (const match of stale) {
      await this.finish(
        match,
        match.status === 'LIVE' ? 'INTERRUPTED' : 'CANCELLED',
        null,
        "Redémarrage de l'API",
      );
    }
    if (stale.length)
      this.logger.warn(`${stale.length} partie(s) fermée(s) après redémarrage`);
  }

  // ───────────────────────────── Outils ─────────────────────────────

  async toDto(match: Match, feedLimit = 8) {
    const p = await this.pseudos(match);
    const feed = await this.db
      .select({
        text: matchEvents.text,
        kind: matchEvents.kind,
        at: matchEvents.createdAt,
      })
      .from(matchEvents)
      .where(eq(matchEvents.matchId, match.id))
      .orderBy(desc(matchEvents.id))
      .limit(feedLimit);
    const end = match.endedAt ?? new Date();
    return {
      id: match.id,
      borneId: match.borneId,
      status: match.status,
      targetScore: match.targetScore,
      left: match.leftUserId ? { id: match.leftUserId, pseudo: p.left } : null,
      right: match.rightUserId
        ? { id: match.rightUserId, pseudo: p.right }
        : match.vsBot
          ? { id: null, pseudo: BOT_PSEUDO }
          : null,
      vsBot: match.vsBot,
      remote: this.remoteSide(match),
      score: { left: match.scoreLeft, right: match.scoreRight },
      winner: match.winnerSide,
      matchPoint:
        match.status === 'LIVE' || match.status === 'COUNTDOWN'
          ? this.matchPoint(match)
          : null,
      endRequests: match.endRequests,
      startRequests: match.startRequests,
      waitingUntil: match.waitingUntil,
      countdownEndsAt: match.countdownEndsAt,
      startedAt: match.startedAt,
      endedAt: match.endedAt,
      durationSec: match.startedAt
        ? Math.max(
            0,
            Math.round((end.getTime() - match.startedAt.getTime()) / 1000),
          )
        : 0,
      stats: {
        maxSpeed: match.maxSpeed,
        maxStreak: match.maxStreak,
        longestRally: match.longestRally,
        totalBounces: match.totalBounces,
      },
      feed,
    };
  }

  private async publish(match: Match) {
    const dto = await this.toDto(match);
    this.realtime.toUsers(
      [match.leftUserId, match.rightUserId],
      'match:update',
      dto,
    );
    return dto;
  }

  private matchPoint(
    m: Pick<Match, 'scoreLeft' | 'scoreRight' | 'targetScore'>,
  ): Side | null {
    const l = m.scoreLeft === m.targetScore - 1;
    const r = m.scoreRight === m.targetScore - 1;
    if (l && !r) return 'left';
    if (r && !l) return 'right';
    return null;
  }

  private async pseudos(match: Match): Promise<Record<Side, string>> {
    const ids = [match.leftUserId, match.rightUserId].filter(
      (id): id is string => !!id,
    );
    const rows = ids.length
      ? await this.db
          .select({ id: users.id, pseudo: users.pseudo })
          .from(users)
          .where(inArray(users.id, ids))
      : [];
    const find = (id: string | null) =>
      (id ? rows.find((r) => r.id === id)?.pseudo : undefined) ?? '???';
    return {
      left: find(match.leftUserId),
      right: match.vsBot ? BOT_PSEUDO : find(match.rightUserId),
    };
  }

  private async activeMatchOf(userId: string) {
    const [match] = await this.db
      .select()
      .from(matches)
      .where(
        and(
          inArray(matches.status, ACTIVE),
          or(eq(matches.leftUserId, userId), eq(matches.rightUserId, userId)),
        ),
      );
    return match ?? null;
  }

  private async getOwn(user: User, matchId: string) {
    const [match] = await this.db
      .select()
      .from(matches)
      .where(eq(matches.id, matchId));
    if (!match) throw new NotFoundException('Partie introuvable.');
    if (match.leftUserId !== user.id && match.rightUserId !== user.id) {
      throw new ForbiddenException('Tu ne joues pas cette partie.');
    }
    return match;
  }

  private log(matchId: string, kind: string, text: string) {
    return this.db.insert(matchEvents).values({ matchId, kind, text });
  }

  /** Exécute les opérations d'une même borne l'une après l'autre (pas de course entre deux buts). */
  private lock<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const previous = this.locks.get(key) ?? Promise.resolve();
    const run = previous.catch(() => undefined).then(fn);
    this.locks.set(
      key,
      run.catch(() => undefined),
    );
    return run;
  }

  private schedule(matchId: string, ms: number, fn: () => Promise<unknown>) {
    this.clearTimer(matchId);
    this.timers.set(
      matchId,
      setTimeout(() => {
        this.timers.delete(matchId);
        fn().catch((err: Error) => this.logger.error(err.message, err.stack));
      }, ms),
    );
  }

  private clearTimer(matchId: string) {
    const t = this.timers.get(matchId);
    if (t) clearTimeout(t);
    this.timers.delete(matchId);
  }
}
