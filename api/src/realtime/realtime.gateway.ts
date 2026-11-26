import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { AuthService } from '../auth/auth.service.js';

/**
 * Temps réel vers l'appli (Socket.IO).
 * Chaque appli connectée rejoint la room `user:<id>` ; le serveur y pousse :
 *  - `match:update` : l'état complet de la partie en cours du joueur
 *  - `borne:status` : { id, online } (diffusé à tout le monde)
 */
@WebSocketGateway({ cors: { origin: '*' } })
export class RealtimeGateway implements OnGatewayConnection {
  private readonly logger = new Logger('Realtime');
  @WebSocketServer() server: Server;

  constructor(private readonly auth: AuthService) {}

  async handleConnection(socket: Socket) {
    const token = (socket.handshake.auth as { token?: string } | undefined)
      ?.token;
    const user = token ? await this.auth.verify(token) : null;
    if (!user) {
      socket.emit('error', 'unauthorized');
      socket.disconnect(true);
      return;
    }
    await socket.join(`user:${user.id}`);
    this.logger.debug(`${user.pseudo} connecté`);
  }

  toUsers(
    userIds: (string | null | undefined)[],
    event: string,
    data: unknown,
  ) {
    const rooms = userIds
      .filter((id): id is string => !!id)
      .map((id) => `user:${id}`);
    if (rooms.length) this.server.to(rooms).emit(event, data);
  }

  broadcast(event: string, data: unknown) {
    this.server.emit(event, data);
  }
}
