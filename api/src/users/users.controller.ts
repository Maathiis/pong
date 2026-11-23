import { Body, Controller, Delete, Get, HttpCode, Patch, UseGuards } from '@nestjs/common';
import { AuthGuard, CurrentUser } from '../auth/auth.guard.js';
import type { User } from '../db/schema.js';
import { SettingsDto } from './settings.dto.js';
import { UsersService } from './users.service.js';

@Controller()
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  @UseGuards(AuthGuard)
  me(@CurrentUser() user: User) {
    return this.users.me(user);
  }

  @Get('me/stats')
  @UseGuards(AuthGuard)
  stats(@CurrentUser() user: User) {
    return this.users.stats(user);
  }

  @Patch('me/settings')
  @UseGuards(AuthGuard)
  settings(@CurrentUser() user: User, @Body() dto: SettingsDto) {
    return this.users.updateSettings(user, dto);
  }

  @Delete('me')
  @UseGuards(AuthGuard)
  @HttpCode(204)
  remove(@CurrentUser() user: User) {
    return this.users.remove(user);
  }

  @Get('leaderboard')
  leaderboard() {
    return this.users.leaderboard();
  }

  @Get('health')
  health() {
    return { ok: true };
  }
}
