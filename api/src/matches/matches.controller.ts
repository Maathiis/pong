import { Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { AuthGuard, CurrentUser } from '../auth/auth.guard.js';
import { BornesService } from '../bornes/bornes.service.js';
import type { User } from '../db/schema.js';
import { MatchesService } from './matches.service.js';

@Controller()
@UseGuards(AuthGuard)
export class MatchesController {
  constructor(
    private readonly matches: MatchesService,
    private readonly bornes: BornesService,
  ) {}

  @Get('bornes')
  listBornes() {
    return this.bornes.list();
  }

  @Get('bornes/:id')
  getBorne(@Param('id') id: string) {
    return this.bornes.get(id);
  }

  /** Appelé quand le joueur scanne le QR code `pong://borne/<id>`. */
  @Post('bornes/:id/join')
  @HttpCode(200)
  join(@CurrentUser() user: User, @Param('id') id: string) {
    return this.matches.join(user, id);
  }

  @Get('matches/current')
  current(@CurrentUser() user: User) {
    return this.matches.current(user);
  }

  @Get('matches/:id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.matches.get(id);
  }

  @Post('matches/:id/leave')
  @HttpCode(200)
  leave(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.matches.leave(user, id);
  }

  @Post('matches/:id/end-request')
  @HttpCode(200)
  requestEnd(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.matches.requestEnd(user, id);
  }
}
