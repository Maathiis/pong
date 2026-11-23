import { Inject, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import { DB, type Db } from '../db/db.module.js';
import { bornes, type Borne } from '../db/schema.js';
import { MqttService } from '../mqtt/mqtt.service.js';
import { RealtimeGateway } from '../realtime/realtime.gateway.js';

@Injectable()
export class BornesService implements OnModuleInit {
  private readonly logger = new Logger('Bornes');

  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly mqtt: MqttService,
    private readonly realtime: RealtimeGateway,
  ) {}

  onModuleInit() {
    // Une borne inconnue est créée automatiquement à son premier message de statut.
    this.mqtt.onStatus(async (id, online) => {
      await this.db
        .insert(bornes)
        .values({ id, online, lastSeenAt: new Date() })
        .onConflictDoUpdate({ target: bornes.id, set: { online, lastSeenAt: new Date() } });
      this.logger.log(`${id} ${online ? 'en ligne' : 'hors ligne'}`);
      this.realtime.broadcast('borne:status', { id, online });
    });
  }

  list() {
    return this.db.select().from(bornes).orderBy(asc(bornes.id));
  }

  async get(id: string): Promise<Borne> {
    const [borne] = await this.db.select().from(bornes).where(eq(bornes.id, id));
    if (!borne) throw new NotFoundException(`Borne « ${id} » inconnue. Est-elle déjà connectée au broker ?`);
    return borne;
  }
}
