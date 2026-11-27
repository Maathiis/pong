import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { User } from '../db/schema.js';
import { LoginDto, RegisterDto } from './auth.dto.js';
import { AuthGuard, CurrentUser } from './auth.guard.js';
import { AuthService } from './auth.service.js';

/** Limites par minute et par adresse IP (réglables pour les tests de charge : RATE_LIMIT_REGISTER, RATE_LIMIT_LOGIN). */
const REGISTER_PER_MIN = Number(process.env.RATE_LIMIT_REGISTER ?? 5);
const LOGIN_PER_MIN = Number(process.env.RATE_LIMIT_LOGIN ?? 10);

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  // R1 : 5 inscriptions et 10 connexions par minute et par adresse IP ; en plus, AuthService bloque un pseudo
  // après 5 échecs (protège un compte même si l'attaquant change d'adresse).
  @Post('register')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: REGISTER_PER_MIN, ttl: 60_000 } })
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Post('login')
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: LOGIN_PER_MIN, ttl: 60_000 } })
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  /** Déconnexion : révoque tous les jetons de ce compte (sur tous les téléphones). */
  @Post('logout')
  @HttpCode(204)
  @UseGuards(AuthGuard)
  async logout(@CurrentUser() user: User) {
    await this.auth.revoke(user);
  }
}
