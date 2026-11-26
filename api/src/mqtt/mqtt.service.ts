import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import mqtt, { type MqttClient } from 'mqtt';

/** Préfixe commun de toutes les topics. Voir docs/CONTRAT-BORNE.md. */
export const TOPIC_ROOT = 'pong/bornes';

export type BorneStatusHandler = (borneId: string, online: boolean) => unknown;
export type BorneEventHandler = (borneId: string, event: Record<string, unknown>) => unknown;

@Injectable()
export class MqttService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('Mqtt');
  private client: MqttClient;
  private readonly statusHandlers: BorneStatusHandler[] = [];
  private readonly eventHandlers: BorneEventHandler[] = [];

  onModuleInit() {
    const url = process.env.MQTT_URL ?? 'mqtt://localhost:1883';
    this.client = mqtt.connect(url, {
      clientId: `pong-api-${process.pid}`,
      reconnectPeriod: 2000,
      // En prod, le broker refuse les connexions anonymes (voir deploy/mosquitto).
      username: process.env.MQTT_USERNAME || undefined,
      password: process.env.MQTT_PASSWORD || undefined,
    });
    this.client.on('connect', () => {
      this.logger.log(`Connecté au broker ${url}`);
      this.client.subscribe([`${TOPIC_ROOT}/+/status`, `${TOPIC_ROOT}/+/events`], { qos: 1 });
    });
    this.client.on('error', (err) => this.logger.warn(`Erreur MQTT : ${err.message}`));
    this.client.on('message', (topic, payload) => void this.dispatch(topic, payload.toString()));
  }

  async onModuleDestroy() {
    await this.client?.endAsync();
  }

  onStatus(handler: BorneStatusHandler) {
    this.statusHandlers.push(handler);
  }

  onEvent(handler: BorneEventHandler) {
    this.eventHandlers.push(handler);
  }

  /** Envoie une commande à une borne (topic pong/bornes/<id>/commands). */
  command(borneId: string, message: Record<string, unknown>) {
    this.client.publish(`${TOPIC_ROOT}/${borneId}/commands`, JSON.stringify(message), { qos: 1 });
  }

  private async dispatch(topic: string, payload: string) {
    const [, , borneId, kind] = topic.split('/');
    if (!borneId || !/^[\w-]{1,32}$/.test(borneId)) return;
    try {
      if (kind === 'status') {
        const value = payload.trim().toLowerCase();
        if (value !== 'online' && value !== 'offline') {
          this.logger.warn(`Statut inconnu de ${borneId} : « ${payload} »`);
          return;
        }
        for (const h of this.statusHandlers) await h(borneId, value === 'online');
      } else if (kind === 'events') {
        let event: unknown;
        try {
          event = JSON.parse(payload);
        } catch {
          this.logger.warn(`JSON invalide reçu de ${borneId} : ${payload}`);
          return;
        }
        if (!event || typeof event !== 'object') return;
        for (const h of this.eventHandlers) await h(borneId, event as Record<string, unknown>);
      }
    } catch (err) {
      this.logger.error(`Erreur en traitant ${topic} : ${(err as Error).message}`, (err as Error).stack);
    }
  }
}
