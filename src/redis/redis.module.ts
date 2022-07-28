import { CacheModule, Module } from '@nestjs/common';
import type { ClientOpts } from 'redis';
import * as redisStore from 'cache-manager-redis-store';

@Module({
  imports: [
    CacheModule.register<ClientOpts>({
      isGlobal: true,
      store: redisStore,
      host: process.env.REDIS_HOST,
      port: +process.env.REDIS_PORT,
    }),
  ],
})
export class RedisModule {}
