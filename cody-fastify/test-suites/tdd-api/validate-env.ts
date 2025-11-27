interface EnvCheckResult {
  name: string;
  status: "ok" | "fail";
  message: string;
}

export async function validateEnvironment(): Promise<void> {
  const startTime = performance.now();
  const results: EnvCheckResult[] = [];

  // 1. Check Redis on 6379
  results.push(await checkRedis());

  // 2. Check Convex connectivity
  results.push(await checkConvex());

  // 3. Check OpenAI API connectivity
  results.push(await checkOpenAI());

  // 4. Check Fastify Server on 4010
  results.push(await checkFastifyServer());

  // 5. Check Anthropic API connectivity
  results.push(await checkAnthropic());

  const endTime = performance.now();
  const totalTimeMs = Math.round(endTime - startTime);

  // Report all results
  console.log("\n=== Environment Validation ===\n");
  for (const r of results) {
    const icon = r.status === "ok" ? "✓" : "✗";
    console.log(`${icon} ${r.name}: ${r.message}`);
  }
  console.log("");

  // Exit if any failed
  const failures = results.filter((r) => r.status === "fail");
  if (failures.length > 0) {
    console.error(
      `❌ ${failures.length} environment check(s) failed. Cannot run tests.\n`,
    );
    console.log(`Total time: ${totalTimeMs}ms\n`);
    process.exit(1);
  }

  console.log("✅ All environment checks passed.");
  console.log(`Total time: ${totalTimeMs}ms\n`);
}

async function checkRedis(): Promise<EnvCheckResult> {
  try {
    const Redis = (await import("ioredis")).default;
    const redis = new Redis({
      port: 6379,
      lazyConnect: true,
      connectTimeout: 2000,
    });
    await redis.connect();
    await redis.ping();
    await redis.quit();
    return { name: "Redis", status: "ok", message: "Running on port 6379" };
  } catch (error) {
    return {
      name: "Redis",
      status: "fail",
      message: "Not reachable on port 6379",
    };
  }
}

async function checkConvex(): Promise<EnvCheckResult> {
  try {
    const { convexClient } = await import(
      "../../src/api/services/convex-client.js"
    );
    const { api } = await import("../../convex/_generated/api.js");
    // Make a simple query to test connectivity with timeout
    const queryPromise = convexClient.query(api.threads.list, {
      paginationOpts: { numItems: 1, cursor: null },
    });
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("Query timeout")), 3000);
    });
    await Promise.race([queryPromise, timeoutPromise]);
    return {
      name: "Convex",
      status: "ok",
      message: "Connected and reachable",
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return {
      name: "Convex",
      status: "fail",
      message: `Not reachable: ${msg}`,
    };
  }
}

async function checkOpenAI(): Promise<EnvCheckResult> {
  try {
    const apiKey = process.env.OPENAI_API_KEY ?? "";
    const res = await fetch("https://api.openai.com/v1/models", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      signal: AbortSignal.timeout(5000),
    });

    if (res.status === 200) {
      return {
        name: "OpenAI",
        status: "ok",
        message: "API reachable, key valid",
      };
    }
    if (res.status === 401 || res.status === 403) {
      return {
        name: "OpenAI",
        status: "fail",
        message: "API key invalid or missing",
      };
    }
    return {
      name: "OpenAI",
      status: "fail",
      message: `Unexpected status: ${res.status}`,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return {
      name: "OpenAI",
      status: "fail",
      message: `Not reachable: ${msg}`,
    };
  }
}

async function checkFastifyServer(): Promise<EnvCheckResult> {
  try {
    const res = await fetch("http://localhost:4010/health", {
      signal: AbortSignal.timeout(2000),
    });
    if (res.ok) {
      return {
        name: "Fastify Server",
        status: "ok",
        message: "Running on port 4010",
      };
    }
    return {
      name: "Fastify Server",
      status: "fail",
      message: `Health check returned ${res.status}`,
    };
  } catch (error) {
    return {
      name: "Fastify Server",
      status: "fail",
      message: "Not running on port 4010",
    };
  }
}

async function checkAnthropic(): Promise<EnvCheckResult> {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY ?? "";
    const res = await fetch("https://api.anthropic.com/v1/models", {
      method: "GET",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      signal: AbortSignal.timeout(5000),
    });

    if (res.status === 200) {
      return {
        name: "Anthropic",
        status: "ok",
        message: "API reachable, key valid",
      };
    }
    if (res.status === 401 || res.status === 403) {
      return {
        name: "Anthropic",
        status: "fail",
        message: "API key invalid or missing",
      };
    }
    return {
      name: "Anthropic",
      status: "fail",
      message: `Unexpected status: ${res.status}`,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return {
      name: "Anthropic",
      status: "fail",
      message: `Not reachable: ${msg}`,
    };
  }
}

// Allow running standalone for testing
if (import.meta.main) {
  await validateEnvironment();
}
