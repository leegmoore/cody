declare module "bun" {
  type RedisCommandArg = string | number | Buffer;

  interface RedisConnectionOptions {
    url?: string;
    hostname?: string;
    port?: number;
    db?: number;
    password?: string;
    tls?: boolean;
  }

  /**
   * Minimal Redis client surface needed for Core 2.0 streaming.
   * Bun includes this client natively; type stubs keep TS strict without any.
   */
  export class RedisClient {
    constructor(urlOrOpts?: string | URL | RedisConnectionOptions);
    command<T = unknown>(...args: RedisCommandArg[]): Promise<T>;
    quit(): Promise<void>;
    ping(): Promise<string>;
  }
}
