// ============================================================================
// JAGAT AI — Redis Cache & Message Broker Service
// ============================================================================

import { Redis } from "ioredis";
import { env } from "../config/index.js";

let client: Redis | null = null;

export function getRedisClient(): Redis {
  if (!client) {
    client = new Redis({
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
      maxRetriesPerRequest: 3,
      retryStrategy(times: number) {
        const delay = Math.min(times * 200, 5000);
        return delay;
      },
      lazyConnect: true,
    });
  }
  return client;
}

/**
 * Ping Redis to verify connectivity.
 * Returns true if PONG received, false otherwise.
 */
export async function pingRedis(): Promise<boolean> {
  try {
    const redis = getRedisClient();
    // Only call connect() if not already connected (lazyConnect singleton)
    if (redis.status === "wait" || redis.status === "end") {
      await redis.connect();
    }
    const response = await redis.ping();
    return response === "PONG";
  } catch {
    return false;
  }
}

/**
 * Gracefully disconnect Redis client.
 */
export async function disconnectRedis(): Promise<void> {
  if (client) {
    await client.quit();
    client = null;
  }
}
