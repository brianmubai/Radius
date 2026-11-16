import { describe, it, expect } from './test-utils.ts';
import { SpatialLoadTester } from '../src/modules/performance/load-test.ts';

describe('GeospatialPerformance — 10,000-Provider Scale & Latency SLA', () => {
  it('achieves p95 search latency strictly under 500 ms with 10,000 seeded providers across multiple cities', () => {
    // Acceptance criterion: "Search p95 latency is under 500 ms at the target provider count, documented in the load test report."
    const loadTester = new SpatialLoadTester();

    // 1. Seed 10,000 providers across SF, Austin, Toronto, and London
    loadTester.seedProviders(10000);

    // 2. Execute 1,000 spatial queries with geographic jitter, filtering, and cache integration
    const report = loadTester.runBenchmark(1000, true);

    console.log('\n--- 10,000-PROVIDER GEOSPATIAL LOAD TEST BENCHMARK REPORT ---');
    console.log(`Target Providers Seeded: ${report.targetProviderCount}`);
    console.log(`Queries Executed:       ${report.queriesExecuted}`);
    console.log(`Throughput:             ${report.qps} QPS`);
    console.log(`Min Latency:            ${report.latencies.minMs} ms`);
    console.log(`Avg Latency:            ${report.latencies.avgMs} ms`);
    console.log(`p50 (Median) Latency:   ${report.latencies.p50Ms} ms`);
    console.log(`p90 Latency:            ${report.latencies.p90Ms} ms`);
    console.log(`p95 Latency:            ${report.latencies.p95Ms} ms`);
    console.log(`p99 Latency:            ${report.latencies.p99Ms} ms`);
    console.log(`p95 < 500ms SLA Passed: ${report.p95Under500ms}`);
    console.log(`Cache Hits / Misses:    ${report.cacheStats.hits} / ${report.cacheStats.misses}`);
    console.log('------------------------------------------------------------\n');

    expect(report.targetProviderCount).toBe(10000);
    expect(report.queriesExecuted).toBe(1000);
    expect(report.p95Under500ms).toBe(true);
    expect(report.latencies.p95Ms).toBeLessThan(500);
  });
});
