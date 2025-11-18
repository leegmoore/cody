import Redis from "ioredis";
import RedisMock from "ioredis-mock";

const DEFAULT_REDIS_URL = process.env.REDIS_URL?.trim() || "mock";

function createRedisClient() {
  if (DEFAULT_REDIS_URL === "mock") {
    return new (RedisMock as unknown as typeof Redis)();
  }

  return new Redis(DEFAULT_REDIS_URL);
}

export const redisClient = createRedisClient();

