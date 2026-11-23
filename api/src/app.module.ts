import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module.js';
import { BornesService } from './bornes/bornes.service.js';
import { DbModule } from './db/db.module.js';
import { MatchesController } from './matches/matches.controller.js';
import { MatchesService } from './matches/matches.service.js';
import { MqttService } from './mqtt/mqtt.service.js';
import { RealtimeGateway } from './realtime/realtime.gateway.js';
import { UsersController } from './users/users.controller.js';
import { UsersService } from './users/users.service.js';

@Module({
  imports: [DbModule, AuthModule],
  controllers: [UsersController, MatchesController],
  providers: [MqttService, RealtimeGateway, BornesService, MatchesService, UsersService],
})
export class AppModule {}
