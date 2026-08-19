import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";

@Injectable()
export class RedisService implements OnModuleDestroy {
  readonly client: Redis;

  constructor(config: ConfigService) {
    this.client = new Redis({
      host: config.get<string>("REDIS_HOST", "127.0.0.1"),
      port: Number(config.get<string>("REDIS_PORT", "6379")),
      username: config.get<string>("REDIS_USERNAME") || undefined,
      password: config.get<string>("REDIS_PASSWORD") || undefined,
      db: Number(config.get<string>("REDIS_DB", "0")),
      lazyConnect: true,
      maxRetriesPerRequest: 2,
      enableReadyCheck: true,
    });
  }

  async ensureConnected(): Promise<void> {
    if (this.client.status === "wait") await this.client.connect();
  }

  async claimNonce(key: string, ttlSeconds: number): Promise<boolean> {
    await this.ensureConnected();
    return (await this.client.set(key, "1", "EX", ttlSeconds, "NX")) === "OK";
  }

  async storeOneTime(key: string, value: string, ttlSeconds: number): Promise<boolean> {
    await this.ensureConnected();
    return (await this.client.set(key, value, "EX", ttlSeconds, "NX")) === "OK";
  }

  async takeOneTime(key: string): Promise<string | null> {
    await this.ensureConnected();
    return this.client.call("GETDEL", key) as Promise<string | null>;
  }

  async ping(): Promise<string> {
    await this.ensureConnected();
    return this.client.ping();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client.status !== "end") await this.client.quit();
  }
}
