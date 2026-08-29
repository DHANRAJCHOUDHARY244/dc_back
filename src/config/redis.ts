import Redis, { type RedisOptions } from "ioredis";

import logger from "@utils/pino";



let client: Redis | null = null;

let pubClient: Redis | null = null;

let subClient: Redis | null = null;

let ready = false;



function redisEnabled() {

  const flag = String(process.env.REDIS_ENABLED ?? "true").toLowerCase();

  return flag !== "false" && flag !== "0";

}



export function getRedisUrl() {

  return process.env.REDIS_URL || "redis://localhost:6379";

}



export function isRedisReady() {

  return ready && !!client;

}



function createClient(url: string, options: RedisOptions = {}) {

  return new Redis(url, {

    maxRetriesPerRequest: 3,

    lazyConnect: true,

    enableReadyCheck: true,

    enableOfflineQueue: false,

    retryStrategy: (times) => (times > 2 ? null : Math.min(times * 250, 1000)),

    reconnectOnError: () => false,

    ...options,

  });

}



export async function connectRedis(): Promise<boolean> {

  if (!redisEnabled()) {

    logger.warn("Redis disabled (REDIS_ENABLED=false) — using in-memory fallbacks");

    return false;

  }



  const url = getRedisUrl();

  let nextClient: Redis | null = null;

  let nextPub: Redis | null = null;

  let nextSub: Redis | null = null;



  try {

    nextClient = createClient(url);

    nextPub = createClient(url, { maxRetriesPerRequest: null });

    nextSub = nextPub.duplicate();



    await Promise.all([nextClient.connect(), nextPub.connect(), nextSub.connect()]);

    await nextClient.ping();



    client = nextClient;

    pubClient = nextPub;

    subClient = nextSub;

    ready = true;



    client.on("error", (err) => logger.error({ err }, "Redis client error"));

    pubClient.on("error", (err) => logger.error({ err }, "Redis pub client error"));

    subClient.on("error", (err) => logger.error({ err }, "Redis sub client error"));



    logger.warn(`Redis connected at ${url}`);

    return true;

  } catch (err) {

    logger.error({ err }, `Redis unavailable at ${url} — falling back to in-memory caches`);

    await Promise.all(

      [nextClient, nextPub, nextSub]

        .filter(Boolean)

        .map((c) => (c as Redis).quit().catch(() => undefined)),

    );

    client = null;

    pubClient = null;

    subClient = null;

    ready = false;

    return false;

  }

}



export async function disconnectRedis() {

  ready = false;

  const toClose = [client, pubClient, subClient].filter(Boolean) as Redis[];

  client = null;

  pubClient = null;

  subClient = null;

  await Promise.all(toClose.map((c) => c.quit().catch(() => undefined)));

}



export function getRedisClient(): Redis | null {

  return ready && client ? client : null;

}



export function getRedisPubSubClients(): { pubClient: Redis; subClient: Redis } | null {

  if (!ready || !pubClient || !subClient) return null;

  return { pubClient, subClient };

}

