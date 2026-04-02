/**
 * k6 Load Test: Mixed Load Scenario
 * Combines all API endpoints in realistic user patterns
 * 
 * Usage: k6 run mixed-load.test.js
 * Realistic scenario: Users browsing, creating, viewing analytics
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Counter, Rate } from 'k6/metrics';

const totalRequests = new Counter('total_requests');
const successRate = new Rate('success_rate');

// Configuration
const BASE_URL = __ENV.API_URL || 'http://localhost:5000';
const AUTH_TOKEN = __ENV.TOKEN || 'Bearer test-token-12345';

// Realistic mixed load scenario
export const options = {
  vus: 20,                    // 20 concurrent users
  duration: '60s',            // 60 second test
  rps: 200,                   // Max 200 req/s
  thresholds: {
    'http_req_duration': ['p(95)<500', 'p(99)<1000'],  // Response times
    'success_rate': ['>=0.95'],                         // 95% success rate
  },
};

// User journey 1: Browse campaigns
export function userJourneyBrowse() {
  // View campaigns
  let res = http.get(
    `${BASE_URL}/api/campaigns?limit=10`,
    { headers: { 'Authorization': AUTH_TOKEN } }
  );
  check(res, { 'browse campaigns 200': (r) => r.status === 200 });
  totalRequests.add(1);
  res.status === 200 ? successRate.add(1) : successRate.add(0);
  sleep(1);

  // View specific campaign
  const campaigns = res.json('data');
  if (campaigns && campaigns.length > 0) {
    const campaignId = campaigns[0].id;
    res = http.get(
      `${BASE_URL}/api/campaigns/${campaignId}`,
      { headers: { 'Authorization': AUTH_TOKEN } }
    );
    check(res, { 'campaign detail 200': (r) => r.status === 200 });
    totalRequests.add(1);
    res.status === 200 ? successRate.add(1) : successRate.add(0);
  }
  sleep(2);
}

// User journey 2: View interactions
export function userJourneyInteractions() {
  // Get interactions
  let res = http.get(
    `${BASE_URL}/api/interactions?limit=20`,
    { headers: { 'Authorization': AUTH_TOKEN } }
  );
  check(res, { 'interactions list 200': (r) => r.status === 200 });
  totalRequests.add(1);
  res.status === 200 ? successRate.add(1) : successRate.add(0);
  sleep(1);

  // Get interaction stats
  res = http.get(
    `${BASE_URL}/api/interactions/stats`,
    { headers: { 'Authorization': AUTH_TOKEN } }
  );
  check(res, { 'interaction stats 200': (r) => r.status === 200 });
  totalRequests.add(1);
  res.status === 200 ? successRate.add(1) : successRate.add(0);
  sleep(1);

  // Get customer interactions
  res = http.get(
    `${BASE_URL}/api/customers/1/interactions`,
    { headers: { 'Authorization': AUTH_TOKEN } }
  );
  check(res, { 'customer interactions 200': (r) => r.status === 200 });
  totalRequests.add(1);
  res.status === 200 ? successRate.add(1) : successRate.add(0);
  sleep(2);
}

// User journey 3: View analytics
export function userJourneyAnalytics() {
  // Overview
  let res = http.get(
    `${BASE_URL}/api/crm-analytics/overview`,
    { headers: { 'Authorization': AUTH_TOKEN } }
  );
  check(res, { 'analytics overview 200': (r) => r.status === 200 });
  totalRequests.add(1);
  res.status === 200 ? successRate.add(1) : successRate.add(0);
  sleep(1);

  // Customer segments
  res = http.get(
    `${BASE_URL}/api/crm-analytics/customer-segments`,
    { headers: { 'Authorization': AUTH_TOKEN } }
  );
  check(res, { 'customer segments 200': (r) => r.status === 200 });
  totalRequests.add(1);
  res.status === 200 ? successRate.add(1) : successRate.add(0);
  sleep(1);

  // Campaign performance
  res = http.get(
    `${BASE_URL}/api/crm-analytics/campaign-performance`,
    { headers: { 'Authorization': AUTH_TOKEN } }
  );
  check(res, { 'campaign performance 200': (r) => r.status === 200 });
  totalRequests.add(1);
  res.status === 200 ? successRate.add(1) : successRate.add(0);
  sleep(1);

  // Trends
  res = http.get(
    `${BASE_URL}/api/crm-analytics/interaction-trends?group_by=day`,
    { headers: { 'Authorization': AUTH_TOKEN } }
  );
  check(res, { 'interaction trends 200': (r) => r.status === 200 });
  totalRequests.add(1);
  res.status === 200 ? successRate.add(1) : successRate.add(0);
  sleep(2);
}

// User journey 4: Create and update
export function userJourneyCreate() {
  // Create campaign
  let res = http.post(
    `${BASE_URL}/api/campaigns`,
    JSON.stringify({
      name: `Campaign-${Date.now()}`,
      description: 'Test campaign',
      status: 'active',
      budget: 5000,
    }),
    { headers: { 'Content-Type': 'application/json', 'Authorization': AUTH_TOKEN } }
  );
  check(res, { 'create campaign 201': (r) => r.status === 201 });
  totalRequests.add(1);
  res.status === 201 ? successRate.add(1) : successRate.add(0);

  const campaignId = res.json('data?.id');
  sleep(1);

  if (campaignId) {
    // Update campaign
    res = http.put(
      `${BASE_URL}/api/campaigns/${campaignId}`,
      JSON.stringify({
        name: `Updated-${Date.now()}`,
      }),
      { headers: { 'Content-Type': 'application/json', 'Authorization': AUTH_TOKEN } }
    );
    check(res, { 'update campaign 200': (r) => r.status === 200 || r.status === 201 });
    totalRequests.add(1);
    res.status === 200 || res.status === 201 ? successRate.add(1) : successRate.add(0);
  }
  sleep(2);
}

// User journey 5: Check sync status
export function userJourneySyncStatus() {
  let res = http.get(
    `${BASE_URL}/api/integration/health`,
    { headers: { 'Authorization': AUTH_TOKEN } }
  );
  check(res, { 'integration health 200': (r) => r.status === 200 });
  totalRequests.add(1);
  res.status === 200 ? successRate.add(1) : successRate.add(0);
  sleep(1);

  res = http.get(
    `${BASE_URL}/api/sync/status`,
    { headers: { 'Authorization': AUTH_TOKEN } }
  );
  check(res, { 'sync status 200': (r) => r.status === 200 });
  totalRequests.add(1);
  res.status === 200 ? successRate.add(1) : successRate.add(0);
  sleep(2);
}

// Simulate various user journeys
export default function() {
  const journeys = [
    userJourneyBrowse,
    userJourneyInteractions,
    userJourneyAnalytics,
    userJourneyCreate,
    userJourneySyncStatus,
  ];

  // Pick a random journey (weighted but more common ones first)
  const rand = Math.random();
  if (rand < 0.35) {
    userJourneyBrowse();
  } else if (rand < 0.60) {
    userJourneyInteractions();
  } else if (rand < 0.80) {
    userJourneyAnalytics();
  } else if (rand < 0.92) {
    userJourneyCreate();
  } else {
    userJourneySyncStatus();
  }

  sleep(1);
}

export function setup() {
  console.log('Mixed Load Test - Realistic Scenario');
  console.log(`Target: ${BASE_URL}`);
  console.log('Simulating:', [
    '35% browsing campaigns/interactions',
    '25% viewing analytics',
    '20% creating/updating',
    '20% checking sync status',
  ].join('\n'));
}

export function teardown() {
  console.log('Mixed Load Test Complete');
}
