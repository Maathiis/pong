import { Global, Inject, Injectable, Logger, Module, OnApplicationShutdown } from '@nestjs/common';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { join } from 'node:path';
import pg from 'pg';
import * as schema from './schema.js';

export type Db = NodePgDatabase<typeof schema>;
export const DB = Symbol('DB');
const POOL = Symbol('PG_POOL');

@Injectable()
class PoolCloser implements OnApplicationShutdown {
  constructor(@Inject(POOL) private readonly pool: pg.Pool) {}
  async onApplicationShutdown() {
    await this.pool.end();
  }
}

@Global()
@Module({
  providers: [
    {
      provide: POOL,
      useFactory: () =>
        new pg.Pool({
          connectionString: process.env.DATABASE_URL ?? 'postgres://pong:pong@localhost:5432/pong',
        }),
    },
    {
      provide: DB,
      inject: [POOL],
      useFactory: async (pool: pg.Pool) => {
        const db = drizzle(pool, { schema });
        // Les migrations SQL (dossier drizzle/) sont appliquées à chaque démarrage.
        await migrate(db, { migrationsFolder: join(process.cwd(), 'drizzle') });
        new Logger('Db').log('Base à jour');
        return db;
      },
    },
    PoolCloser,
  ],
  exports: [DB],
})
export class DbModule {}
