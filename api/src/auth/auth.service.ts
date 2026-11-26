import { ConflictException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { DB, type Db } from '../db/db.module.js';
import { users, type User } from '../db/schema.js';
import { LoginDto, RegisterDto } from './auth.dto.js';

export interface JwtPayload {
  sub: string;
}

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
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly jwt: JwtService,
  ) {}

  /** Inscription avec pseudo et mot de passe seulement : aucune autre donnée personnelle (minimisation RGPD). */
  async register(dto: RegisterDto) {
    const [taken] = await this.db.select({ id: users.id }).from(users).where(eq(users.pseudo, dto.pseudo));
    if (taken) throw new ConflictException('Ce pseudo est déjà pris.');
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
    const [user] = await this.db.select().from(users).where(eq(users.pseudo, dto.pseudo));
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Pseudo ou mot de passe incorrect.');
    }
    return this.session(user);
  }

  /** Renvoie l'utilisateur derrière un jeton, ou null si le jeton est invalide. */
  async verify(token: string): Promise<User | null> {
    try {
      const payload = await this.jwt.verifyAsync<JwtPayload>(token);
      const [user] = await this.db.select().from(users).where(eq(users.id, payload.sub));
      return user ?? null;
    } catch {
      return null;
    }
  }

  private async session(user: User) {
    const token = await this.jwt.signAsync({ sub: user.id } satisfies JwtPayload);
    return { token, user: toPublicUser(user) };
  }
}
