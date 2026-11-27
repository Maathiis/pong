import { ConflictException, HttpException, HttpStatus, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { eq, sql } from 'drizzle-orm';
import { DB, type Db } from '../db/db.module.js';
import { BOT_PSEUDO, users, type User } from '../db/schema.js';
import { LoginDto, RegisterDto } from './auth.dto.js';

export interface JwtPayload {
  sub: string;
  /** version du jeton : doit valoir users.token_version (sinon jeton révoqué) */
  v: number;
}

/** Échecs de connexion tolérés par pseudo avant blocage temporaire (R1). */
const MAX_FAILURES = 5;
const FAILURE_WINDOW_MS = 15 * 60_000;

export function toPublicUser(u: User) {
  return {
    id: u.id,
    pseudo: u.pseudo,
    settings: {
      alertOffline: u.alertOffline,
      alertSpeedRecord: u.alertSpeedRecord,
      alertMatchPoint: u.alertMatchPoint,
      retroSounds: u.retroSounds,
      speedAlertThreshold: u.speedAlertThreshold,
    },
  };
}

@Injectable()
export class AuthService {
  /** pseudo → instants des derniers échecs (en mémoire : un redémarrage remet les compteurs à zéro). */
  private readonly failures = new Map<string, number[]>();

  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly jwt: JwtService,
  ) {}

  /** Inscription avec pseudo et mot de passe seulement : aucune autre donnée personnelle (minimisation RGPD). */
  async register(dto: RegisterDto) {
    const [taken] = await this.db.select({ id: users.id }).from(users).where(eq(users.pseudo, dto.pseudo));
    if (taken || dto.pseudo === BOT_PSEUDO) throw new ConflictException('Ce pseudo est déjà pris.');
    const [user] = await this.db
      .insert(users)
      .values({
        pseudo: dto.pseudo,
        passwordHash: await bcrypt.hash(dto.password, 10),
        consentAt: new Date(),
      })
      .returning();
    return this.session(user);
  }

  async login(dto: LoginDto) {
    const now = Date.now();
    const recent = (this.failures.get(dto.pseudo) ?? []).filter((t) => now - t < FAILURE_WINDOW_MS);
    if (recent.length >= MAX_FAILURES) {
      const wait = Math.ceil((recent[0] + FAILURE_WINDOW_MS - now) / 60_000);
      throw new HttpException(`Trop d'essais pour ce pseudo : réessaie dans ${wait} min.`, HttpStatus.TOO_MANY_REQUESTS);
    }
    const [user] = await this.db.select().from(users).where(eq(users.pseudo, dto.pseudo));
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      this.failures.set(dto.pseudo, [...recent, now]);
      throw new UnauthorizedException('Pseudo ou mot de passe incorrect.');
    }
    this.failures.delete(dto.pseudo);
    return this.session(user);
  }

  /** Déconnexion : tous les jetons déjà émis pour ce compte deviennent invalides. */
  async revoke(user: User) {
    await this.db
      .update(users)
      .set({ tokenVersion: sql`${users.tokenVersion} + 1` })
      .where(eq(users.id, user.id));
  }

  /** Renvoie l'utilisateur derrière un jeton, ou null si le jeton est invalide. */
  async verify(token: string): Promise<User | null> {
    try {
      const payload = await this.jwt.verifyAsync<JwtPayload>(token);
      const [user] = await this.db.select().from(users).where(eq(users.id, payload.sub));
      // jeton révoqué (déconnexion) ou émis avant l'introduction des versions : refusé
      return user && payload.v === user.tokenVersion ? user : null;
    } catch {
      return null;
    }
  }

  private async session(user: User) {
    const token = await this.jwt.signAsync({ sub: user.id, v: user.tokenVersion } satisfies JwtPayload);
    return { token, user: toPublicUser(user) };
  }
}
