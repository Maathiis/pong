import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
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
 *  - `pad:ack` : { n } quand la borne a reçu la commande de manette n (mesure de latence)
 * Et reçoit de l'appli :
 *  - `pad` : { dir: -1 | 0 | 1, n } (manette du téléphone, relayée à la borne par MatchesService)
 */
@WebSocketGateway({ cors: { origin: '*' } })
export class RealtimeGateway implements OnGatewayConnection {
  private readonly logger = new Logger('Realtime');
  @WebSocketServer() server: Server;

  /** Branché par MatchesService (évite une dépendance circulaire entre les deux). */
  private padHandler?: (userId: string, dir: number, n: number) => void;

  constructor(private readonly auth: AuthService) {}

  onPad(handler: (userId: string, dir: number, n: number) => void) {
    this.padHandler = handler;
  }

  @SubscribeMessage('pad')
  handlePad(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: { dir?: unknown; n?: unknown } | undefined,
  ) {
    const userId = (socket.data as { userId?: string }).userId;
    const dir = body?.dir;
    const n = body?.n;
    if (!userId || (dir !== -1 && dir !== 0 && dir !== 1)) return;
    if (typeof n !== 'number' || !Number.isInteger(n)) return;
    this.padHandler?.(userId, dir, n);
  }

  async handleConnection(socket: Socket) {
    const token = (socket.handshake.auth as { token?: string } | undefined)
      ?.token;
    const user = token ? await this.auth.verify(token) : null;
    if (!user) {
      socket.emit('error', 'unauthorized');
      socket.disconnect(true);
      return;
    }
    (socket.data as { userId?: string }).userId = user.id;
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
