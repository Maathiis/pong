import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { IsString } from 'class-validator';
import { AuthGuard, CurrentUser } from '../auth/auth.guard.js';
import { BornesService } from '../bornes/bornes.service.js';
import type { User } from '../db/schema.js';
import { MatchesService } from './matches.service.js';

class JoinCodeDto {
  @IsString() code: string;
}

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

  /** Le joueur a scanné le QR code affiché sur la matrice de la borne. */
  @Post('matches/join')
  @HttpCode(200)
  join(@CurrentUser() user: User, @Body() dto: JoinCodeDto) {
    return this.matches.joinByCode(user, dto.code);
  }

  @Get('matches/current')
  current(@CurrentUser() user: User) {
    return this.matches.current(user);
  }

  @Get('matches/:id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.matches.get(id);
  }

  @Post('matches/:id/start')
  @HttpCode(200)
  start(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.matches.start(user, id);
  }

  /** Seul dans la salle : jouer contre le bot de la borne (raquette droite). */
  @Post('matches/:id/bot')
  @HttpCode(200)
  playBot(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.matches.playBot(user, id);
  }

  @Post('matches/:id/leave')
  @HttpCode(200)
  leave(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.matches.leave(user, id);
  }

  @Post('matches/:id/end-request')
  @HttpCode(200)
  requestEnd(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.matches.requestEnd(user, id);
  }
}
