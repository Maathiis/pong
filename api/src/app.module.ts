import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module.js';
import { BornesService } from './bornes/bornes.service.js';
import { DbModule } from './db/db.module.js';
import { MatchesController } from './matches/matches.controller.js';
import { MatchesService } from './matches/matches.service.js';
import { MqttService } from './mqtt/mqtt.service.js';
import { AlertsService } from './realtime/alerts.service.js';
import { RealtimeGateway } from './realtime/realtime.gateway.js';
import { UsersController } from './users/users.controller.js';
import { UsersService } from './users/users.service.js';

@Module({
  // Limite de débit (R1) : appliquée aux routes d'authentification, voir AuthController.
  imports: [DbModule, AuthModule, ThrottlerModule.forRoot([{ ttl: 60_000, limit: 10 }])],
  controllers: [UsersController, MatchesController],
  providers: [MqttService, RealtimeGateway, AlertsService, BornesService, MatchesService, UsersService],
})
export class AppModule {}
