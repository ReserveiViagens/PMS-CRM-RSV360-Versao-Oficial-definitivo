/**
 * k6 Load Test: Sync API
 * Tests performance of sync/integration endpoints under load
 * 
 * Usage: k6 run sync.test.js
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Counter, Trend, Rate } from 'k6/metrics';

// Define metrics
const syncStatusTime = new Trend('sync_status_time');
const syncExecuteTime = new Trend('sync_execute_time');
const syncLogsTime = new Trend('sync_logs_time');
const healthCheckTime = new Trend('health_check_time');
const compareTime = new Trend('sync_compare_time');

const syncErrors = new Counter('sync_errors');
const syncSuccessRate = new Rate('sync_success_rate');

// Configuration
const BASE_URL = __ENV.API_URL || 'http://localhost:5000';
const AUTH_TOKEN = __ENV.TOKEN || 'Bearer test-token-12345';

// VU Configuration
export const options = {
  vus: 5,
  duration: '30s',
  rps: 50,
  thresholds: {
    'sync_status_time': ['p(95)<500'],
    'sync_execute_time': ['p(95)<2000'],
    'sync_logs_time': ['p(95)<600'],
    'health_check_time': ['p(95)<300'],
    'sync_compare_time': ['p(95)<1000'],
    'sync_success_rate': ['>=0.95'],
  },
};

// Test sync status
export function testSyncStatus() {
  return group('Sync Status', function() {
    const res = http.get(
      `${BASE_URL}/api/sync/status`,
      {
        headers: {
          'Authorization': AUTH_TOKEN,
        },
      }
    );

    syncStatusTime.add(res.timings.duration);
    const success = check(res, {
      'status 200': (r) => r.status === 200,
      'has v1 status': (r) => r.json('data.backend_v1') !== null,
      'has v2 status': (r) => r.json('data.backend_v2') !== null,
      'response time < 500ms': (r) => r.timings.duration < 500,
    });

    if (success) {
      syncSuccessRate.add(1);
    } else {
      syncErrors.add(1);
      syncSuccessRate.add(0);
    }
  });
}

// Test sync customers
export function testSyncCustomers() {
  return group('Sync Customers', function() {
    const res = http.post(
      `${BASE_URL}/api/sync/customers`,
      JSON.stringify({}),
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': AUTH_TOKEN,
        },
      }
    );

    syncExecuteTime.add(res.timings.duration);
    const success = check(res, {
      'status 200': (r) => r.status === 200,
      'has sync result': (r) => r.json('data.synced') !== null,
      'response time < 2000ms': (r) => r.timings.duration < 2000,
    });

    if (success) {
      syncSuccessRate.add(1);
    } else {
      syncErrors.add(1);
      syncSuccessRate.add(0);
    }
  });
}

// Test sync campaigns
export function testSyncCampaigns() {
  return group('Sync Campaigns', function() {
    const res = http.post(
      `${BASE_URL}/api/sync/campaigns`,
      JSON.stringify({}),
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': AUTH_TOKEN,
        },
      }
    );

    check(res, {
      'status 200': (r) => r.status === 200,
      'response time < 2000ms': (r) => r.timings.duration < 2000,
    });
  });
}

// Test sync interactions
export function testSyncInteractions() {
  return group('Sync Interactions', function() {
    const res = http.post(
      `${BASE_URL}/api/sync/interactions`,
      JSON.stringify({}),
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': AUTH_TOKEN,
        },
      }
    );

    check(res, {
      'status 200': (r) => r.status === 200,
      'response time < 2000ms': (r) => r.timings.duration < 2000,
    });
  });
}

// Test sync bookings
export function testSyncBookings() {
  return group('Sync Bookings', function() {
    const res = http.post(
      `${BASE_URL}/api/sync/bookings`,
      JSON.stringify({}),
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': AUTH_TOKEN,
        },
      }
    );

    check(res, {
      'status 200': (r) => r.status === 200,
      'response time < 2000ms': (r) => r.timings.duration < 2000,
    });
  });
}

// Test integration health
export function testIntegrationHealth() {
  return group('Integration Health', function() {
    const res = http.get(
      `${BASE_URL}/api/integration/health`,
      {
        headers: {
          'Authorization': AUTH_TOKEN,
        },
      }
    );

    healthCheckTime.add(res.timings.duration);
    const success = check(res, {
      'health status 200': (r) => r.status === 200,
      'has both backends': (r) => 
        r.json('data.backend_v1') !== null && 
        r.json('data.backend_v2') !== null,
      'response time < 300ms': (r) => r.timings.duration < 300,
    });

    if (success) {
      syncSuccessRate.add(1);
    } else {
      syncErrors.add(1);
      syncSuccessRate.add(0);
    }
  });
}

// Test compare entities
export function testCompareEntities() {
  return group('Compare Entities', function() {
    const entities = ['customers', 'campaigns', 'interactions', 'bookings'];

    for (const entity of entities) {
      const res = http.get(
        `${BASE_URL}/api/integration/compare/${entity}`,
        {
          headers: {
            'Authorization': AUTH_TOKEN,
          },
        }
      );

      compareTime.add(res.timings.duration);
      const success = check(res, {
        'compare status 200': (r) => r.status === 200,
        'has differences': (r) => r.json('data.differences') !== null,
        'response time < 1000ms': (r) => r.timings.duration < 1000,
      });

      if (success) {
        syncSuccessRate.add(1);
      } else {
        syncErrors.add(1);
        syncSuccessRate.add(0);
      }
    }
  });
}

// Test sync logs
export function testSyncLogs() {
  return group('Sync Logs', function() {
    const res = http.get(
      `${BASE_URL}/api/integration/sync-logs?limit=20`,
      {
        headers: {
          'Authorization': AUTH_TOKEN,
        },
      }
    );

    syncLogsTime.add(res.timings.duration);
    check(res, {
      'logs status 200': (r) => r.status === 200,
      'has logs array': (r) => Array.isArray(r.json('data.logs')),
      'response time < 600ms': (r) => r.timings.duration < 600,
    });
  });
}

// Test full sync all
export function testSyncAll() {
  return group('Sync All', function() {
    const res = http.post(
      `${BASE_URL}/api/integration/sync-all`,
      JSON.stringify({
        entities: ['customers', 'campaigns', 'interactions', 'bookings'],
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': AUTH_TOKEN,
        },
      }
    );

    const success = check(res, {
      'sync-all status 200': (r) => r.status === 200,
      'has all entities': (r) =>
        r.json('data.customers') !== null &&
        r.json('data.campaigns') !== null,
      'response time < 3000ms': (r) => r.timings.duration < 3000,
    });

    if (success) {
      syncSuccessRate.add(1);
    } else {
      syncErrors.add(1);
      syncSuccessRate.add(0);
    }
  });
}

// Main test execution
export default function() {
  // Check health first
  testIntegrationHealth();
  sleep(1);

  // Check sync status
  testSyncStatus();
  sleep(1);

  // Get sync logs (lightweight)
  testSyncLogs();
  sleep(1);

  // Compare entities (read-heavy)
  testCompareEntities();
  sleep(2);

  // Sync individual entities
  testSyncCustomers();
  sleep(2);

  // Don't sync all entities frequently (expensive operation)
  // Randomly decide whether to run (10% chance)
  if (Math.random() < 0.1) {
    testSyncAll();
    sleep(3);
  }
}

export function setup() {
  console.log('Sync/Integration Load Test Starting...');
}

export function teardown() {
  console.log('Sync/Integration Load Test Complete');
}
