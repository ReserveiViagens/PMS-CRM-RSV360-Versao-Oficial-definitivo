/**
 * k6 Load Test: Stress Test Scenario
 * Tests system under extreme load to find breaking point
 * 
 * Usage: k6 run stress-test.js
 * Ramps up load gradually to identify limits
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Gauge } from 'k6/metrics';

const errorCount = new Counter('stress_errors');
const successRate = new Rate('stress_success_rate');
const activeRequests = new Gauge('active_requests');

// Configuration
const BASE_URL = __ENV.API_URL || 'http://localhost:5000';
const AUTH_TOKEN = __ENV.TOKEN || 'Bearer test-token-12345';

// Stress test with ramping load
export const options = {
  stages: [
    // Ramp-up
    { duration: '2m', target: 10 },   // 10 users for 2 min
    { duration: '2m', target: 20 },   // ramp to 20 users
    { duration: '2m', target: 50 },   // ramp to 50 users
    { duration: '2m', target: 100 },  // ramp to 100 users
    
    // Peak load
    { duration: '3m', target: 100 },  // hold 100 users for 3 min
    
    // Ramp-down
    { duration: '2m', target: 50 },   // ramp down to 50
    { duration: '2m', target: 0 },    // ramp down to 0
  ],
  thresholds: {
    'http_req_duration': ['p(95)<1000', 'p(99)<2000'],
    'stress_success_rate': ['>=0.90'],  // Slightly lower for stress test
  },
};

// Heavy load endpoint - campaigns
function stressTestCampaigns() {
  const res = http.get(
    `${BASE_URL}/api/campaigns?limit=50&offset=${Math.floor(Math.random() * 1000)}`,
    { headers: { 'Authorization': AUTH_TOKEN } }
  );

  const success = check(res, {
    'campaigns 200': (r) => r.status === 200,
  });

  success ? successRate.add(1) : (errorCount.add(1), successRate.add(0));
}

// Heavy load endpoint - interactions
function stressTestInteractions() {
  const res = http.get(
    `${BASE_URL}/api/interactions?limit=50`,
    { headers: { 'Authorization': AUTH_TOKEN } }
  );

  const success = check(res, {
    'interactions 200': (r) => r.status === 200,
  });

  success ? successRate.add(1) : (errorCount.add(1), successRate.add(0));
}

// Heavy load endpoint - analytics (most expensive)
function stressTestAnalytics() {
  const res = http.get(
    `${BASE_URL}/api/crm-analytics/overview`,
    { headers: { 'Authorization': AUTH_TOKEN } }
  );

  const success = check(res, {
    'analytics overview 200': (r) => r.status === 200,
  });

  success ? successRate.add(1) : (errorCount.add(1), successRate.add(0));
}

// Create operations under stress
function stressTestCreate() {
  const res = http.post(
    `${BASE_URL}/api/interactions`,
    JSON.stringify({
      customer_id: Math.floor(Math.random() * 100) + 1,
      interaction_type: ['email', 'call', 'chat'][Math.floor(Math.random() * 3)],
      description: `Stress test ${Date.now()}`,
      status: 'pending',
    }),
    { headers: { 'Content-Type': 'application/json', 'Authorization': AUTH_TOKEN } }
  );

  const success = check(res, {
    'create 201': (r) => r.status === 201,
  });

  success ? successRate.add(1) : (errorCount.add(1), successRate.add(0));
}

// Main stress test execution
export default function() {
  const operations = [
    stressTestCampaigns,
    stressTestCampaigns,
    stressTestCampaigns,
    stressTestInteractions,
    stressTestInteractions,
    stressTestAnalytics,
    stressTestAnalytics,
    stressTestCreate,
  ];

  // Random operation
  const op = operations[Math.floor(Math.random() * operations.length)];
  op();

  // Small sleep to avoid thundering herd
  sleep(Math.random() * 0.5);
}

export function setup() {
  console.log('Stress Test Starting - Ramping Load');
  console.log('Stages:');
  console.log('  0-2min:  10 VUs (ramp-up)');
  console.log('  2-4min:  20 VUs');
  console.log('  4-6min:  50 VUs');
  console.log('  6-8min:  100 VUs (peak)');
  console.log('  8-11min: 100 VUs (hold)');
  console.log('  11-13min: 50 VUs (ramp-down)');
  console.log('  13-15min: 0 VUs (cool-down)');
}

export function teardown() {
  console.log('Stress Test Complete');
}
