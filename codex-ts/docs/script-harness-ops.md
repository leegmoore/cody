# Script Harness Operator Guide

**Version:** 1.0.0
**Last Updated:** 2025-11-07

---

## Overview

Operational guide for monitoring, troubleshooting, and performance tuning the Codex TypeScript Script Harness in production environments.

---

## Table of Contents

1. [Monitoring](#monitoring)
2. [Key Metrics](#key-metrics)
3. [Performance Tuning](#performance-tuning)
4. [Troubleshooting](#troubleshooting)
5. [Capacity Planning](#capacity-planning)
6. [Incident Response](#incident-response)
7. [Best Practices](#best-practices)

---

## Monitoring

### Essential Metrics to Track

#### Script Execution

```typescript
// Instrument script execution
const startTime = Date.now()
const result = await executeScript(context, script)
const duration = Date.now() - startTime

metrics.histogram('script.execution.duration_ms', duration)
metrics.counter('script.execution.total', { status: result.ok ? 'success' : 'failure' })
```

#### Worker Pool

```typescript
// Monitor worker pool health
metrics.gauge('worker_pool.size', workerPool.size)
metrics.gauge('worker_pool.busy', workerPool.busyCount)
metrics.gauge('worker_pool.available', workerPool.availableCount)
metrics.counter('worker_pool.recycled', workerPool.recycleCount)
```

#### Cache Performance

```typescript
// Track cache effectiveness
metrics.gauge('script_cache.size', scriptCache.size)
metrics.counter('script_cache.hits', cacheHits)
metrics.counter('script_cache.misses', cacheMisses)
metrics.gauge('script_cache.hit_rate', cacheHits / (cacheHits + cacheMisses))
```

#### Tool Usage

```typescript
// Monitor tool call patterns
metrics.counter('tool.calls.total', { tool: toolName })
metrics.histogram('tool.call.duration_ms', duration, { tool: toolName })
metrics.counter('tool.errors', { tool: toolName, error: errorCode })
```

---

## Key Metrics

### Performance Metrics

| Metric | Type | Target | Alert If |
|--------|------|--------|----------|
| `script.execution.duration_ms` | Histogram | p95 < 5s | p95 > 10s |
| `script.execution.total` | Counter | - | Error rate > 5% |
| `tool.call.duration_ms` | Histogram | p95 < 1s | p95 > 3s |
| `worker_pool.busy` | Gauge | < 80% | > 90% |
| `script_cache.hit_rate` | Gauge | > 80% | < 50% |

### Resource Metrics

| Metric | Type | Target | Alert If |
|--------|------|--------|----------|
| `memory.heap.used_mb` | Gauge | < 70% limit | > 90% limit |
| `memory.heap.total_mb` | Gauge | - | Growing > 10%/hour |
| `cpu.usage_percent` | Gauge | < 70% | > 90% |
| `worker_pool.size` | Gauge | 2-8 | < 1 or > 16 |

### Error Metrics

| Metric | Type | Alert If |
|--------|------|----------|
| `errors.timeout` | Counter | > 10/minute |
| `errors.parse` | Counter | > 5/minute |
| `errors.sandbox_violation` | Counter | > 1/minute |
| `errors.tool_failed` | Counter | > 20/minute |

---

## Performance Tuning

### Worker Pool Tuning

#### Default Configuration
```typescript
workerPool: {
  maxWorkers: Math.min(2, cpus().length),
  recycleAfter: 100,
}
```

#### High Throughput
```typescript
workerPool: {
  maxWorkers: cpus().length,  // All CPUs
  recycleAfter: 200,          // Less frequent recycling
}
```

#### Low Latency
```typescript
workerPool: {
  minWorkers: 2,  // Pre-warm workers
  maxWorkers: 4,
  recycleAfter: 50,
}
```

#### Resource Constrained
```typescript
workerPool: {
  maxWorkers: 1,  // Minimal workers
  recycleAfter: 25,
}
```

---

### Cache Tuning

#### Monitor Cache Hit Rate

```typescript
const hitRate = cacheHits / (cacheHits + cacheMisses)

if (hitRate < 0.5) {
  // Increase cache size
  scriptCacheSize = scriptCacheSize * 2
}
```

#### Tune Cache Sizes

| Workload | Script Cache | Compilation Cache |
|----------|--------------|-------------------|
| Development | 500 | 500 |
| Production | 2000 | 2000 |
| High Volume | 5000 | 5000 |
| Memory Constrained | 100 | 100 |

---

### Execution Limits

#### Tune Based on Workload

```typescript
// For API endpoints (fast)
limits: {
  maxExecutionTimeMs: 5000,
  maxToolCalls: 20,
}

// For background jobs (slow)
limits: {
  maxExecutionTimeMs: 60000,
  maxToolCalls: 200,
}

// For trusted scripts (unlimited)
limits: {
  maxExecutionTimeMs: 300000,  // 5 minutes
  maxToolCalls: 1000,
}
```

---

## Troubleshooting

### High CPU Usage

**Symptoms:**
- CPU > 90%
- Slow script execution
- Worker pool saturation

**Diagnosis:**
```bash
# Check worker pool status
curl http://localhost:3000/metrics | grep worker_pool

# Check concurrent scripts
curl http://localhost:3000/metrics | grep concurrent_scripts
```

**Solutions:**
1. Reduce `maxConcurrentScripts`
2. Optimize hot scripts
3. Add more CPU capacity
4. Enable script caching

---

### High Memory Usage

**Symptoms:**
- Memory > 90% limit
- OOM errors
- Frequent GC pauses

**Diagnosis:**
```bash
# Check heap usage
node --expose-gc script-harness.js

# Profile memory
node --heap-prof script-harness.js
```

**Solutions:**
1. Reduce cache sizes
2. Lower `maxConcurrentScripts`
3. Enable worker recycling
4. Add more memory
5. Process data in chunks

---

### Slow Script Execution

**Symptoms:**
- p95 latency > 10s
- Execution timeouts
- User complaints

**Diagnosis:**
```typescript
// Add timing logs
console.time('script-execution')
const result = await executeScript(context, script)
console.timeEnd('script-execution')

// Profile tool calls
for (const call of result.toolCalls) {
  console.log(`${call.tool}: ${call.duration}ms`)
}
```

**Solutions:**
1. Optimize slow tool calls
2. Reduce tool call count
3. Increase execution timeout
4. Use detached tasks for long ops
5. Cache expensive operations

---

### Cache Thrashing

**Symptoms:**
- Hit rate < 50%
- Frequent evictions
- Inconsistent performance

**Diagnosis:**
```bash
# Monitor cache metrics
curl http://localhost:3000/metrics | grep cache

# Check eviction rate
eviction_rate = cache_evictions / cache_accesses
```

**Solutions:**
1. Increase cache size
2. Review cache key strategy
3. Reduce number of unique scripts
4. Use smaller script sizes

---

### Worker Pool Exhaustion

**Symptoms:**
- All workers busy
- Queuing delays
- `WORKER_POOL_EXHAUSTED` errors

**Diagnosis:**
```bash
# Check worker status
curl http://localhost:3000/debug/workers

# Monitor queue depth
curl http://localhost:3000/metrics | grep queue_depth
```

**Solutions:**
1. Increase `maxWorkers`
2. Reduce script execution time
3. Add load balancing
4. Implement rate limiting

---

## Capacity Planning

### Estimating Worker Pool Size

```typescript
// Formula: workers = (concurrent_scripts * avg_duration_ms) / 1000

// Example: 100 scripts/sec, 50ms average duration
const workers = (100 * 50) / 1000  // = 5 workers
```

### Memory Requirements

```typescript
// Formula: memory = base + (workers * worker_memory) + cache_memory

// Example:
const baseMemory = 100 // MB (Node.js overhead)
const workerMemory = 50 // MB per worker
const cacheMemory = 200 // MB (script + compilation cache)
const totalMemory = baseMemory + (8 * workerMemory) + cacheMemory
// = 700 MB
```

### Load Testing

```typescript
// Simulate load
const concurrency = 100
const duration = 60000 // 60 seconds

const results = await loadTest({
  concurrency,
  duration,
  scriptGenerator: () => generateRandomScript(),
})

console.log('Throughput:', results.successCount / (duration / 1000), 'scripts/sec')
console.log('p95 latency:', results.p95Latency, 'ms')
console.log('Error rate:', results.errorRate, '%')
```

---

## Incident Response

### High Error Rate

1. **Check error distribution**
   ```bash
   curl http://localhost:3000/metrics | grep errors
   ```

2. **Identify pattern**
   - Single error code? → Specific issue
   - Multiple error codes? → System-wide issue

3. **Immediate actions**
   - Enable debug logging
   - Reduce traffic if needed
   - Check recent deployments

4. **Long-term fix**
   - Address root cause
   - Add monitoring
   - Update runbooks

---

### Performance Degradation

1. **Collect metrics**
   ```bash
   # CPU, memory, latency
   curl http://localhost:3000/metrics
   ```

2. **Compare to baseline**
   - Recent change?
   - Gradual or sudden?
   - Correlated with traffic?

3. **Immediate actions**
   - Scale horizontally
   - Reduce limits
   - Clear caches

4. **Root cause**
   - Profile hot paths
   - Review recent changes
   - Check dependencies

---

### Service Outage

1. **Assess impact**
   - All requests failing?
   - Partial failure?
   - Specific tool/feature?

2. **Immediate response**
   - Restart service
   - Rollback recent changes
   - Failover to backup

3. **Post-mortem**
   - Document timeline
   - Identify root cause
   - Implement fixes
   - Update runbooks

---

## Best Practices

### Monitoring

1. **Use structured logging**
   ```typescript
   logger.info('script-executed', {
     scriptId,
     duration,
     toolCalls: result.toolCalls.length,
     success: result.ok,
   })
   ```

2. **Set up alerts**
   - Error rate > 5%
   - Latency p95 > 10s
   - Worker pool > 90% busy
   - Memory > 90% used

3. **Track trends**
   - Daily metrics review
   - Weekly capacity review
   - Monthly performance analysis

---

### Deployment

1. **Canary releases**
   ```typescript
   // Route 10% traffic to new version
   if (Math.random() < 0.1) {
     return newScriptHarness
   }
   return currentScriptHarness
   ```

2. **Health checks**
   ```typescript
   app.get('/health', async (req, res) => {
     const workerHealth = await checkWorkerPool()
     const cacheHealth = await checkCaches()

     if (workerHealth && cacheHealth) {
       res.status(200).json({ status: 'healthy' })
     } else {
       res.status(503).json({ status: 'unhealthy' })
     }
   })
   ```

3. **Graceful shutdown**
   ```typescript
   process.on('SIGTERM', async () => {
     // Stop accepting new scripts
     server.close()

     // Wait for in-flight scripts
     await waitForInflightScripts()

     // Shutdown worker pool
     await workerPool.shutdown()

     process.exit(0)
   })
   ```

---

### Security

1. **Audit sandbox violations**
   ```typescript
   metrics.counter('sandbox_violations', { user, operation })
   // Alert if violations spike
   ```

2. **Monitor resource usage**
   ```typescript
   // Per-user quotas
   const userUsage = await getUserResourceUsage(userId)
   if (userUsage.scriptsPerHour > RATE_LIMIT) {
     throw new Error('Rate limit exceeded')
   }
   ```

3. **Review tool usage**
   ```typescript
   // Flag unusual patterns
   if (toolCallFrequency['exec'] > THRESHOLD) {
     logger.warn('High exec usage', { userId })
   }
   ```

---

## Emergency Procedures

### Service Unresponsive

```bash
# 1. Check process
ps aux | grep node

# 2. Check resources
top -p <pid>

# 3. Generate heap dump
kill -USR2 <pid>

# 4. Restart if needed
systemctl restart codex-script-harness
```

### Memory Leak

```bash
# 1. Enable GC logging
node --trace-gc script-harness.js

# 2. Take heap snapshots
node --heap-prof script-harness.js

# 3. Analyze with Chrome DevTools
chrome://inspect

# 4. Deploy fix + restart
```

### Cascading Failures

```bash
# 1. Implement circuit breaker
if (errorRate > 0.5) {
  return { ok: false, error: 'Circuit breaker open' }
}

# 2. Reduce traffic
# Use load balancer to shed load

# 3. Scale resources
# Add more workers/memory

# 4. Fix root cause
```

---

## See Also

- [Configuration Guide](./script-harness-config.md)
- [Error Catalog](./script-harness-errors.md)
