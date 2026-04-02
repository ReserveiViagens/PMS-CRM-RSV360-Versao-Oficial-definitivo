/**
 * k6 Load Test: Interaction API
 * Tests performance of interaction endpoints under load
 * 
 * Usage: k6 run interactions.test.js
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Counter, Trend, Rate } from 'k6/metrics';

// Define metrics
const interactionCreateTime = new Trend('interaction_create_time');
const interactionGetListTime = new Trend('interaction_list_time');
const interactionGetDetailTime = new Trend('interaction_detail_time');
const interactionStatsTime = new Trend('interaction_stats_time');
const interactionUpdateTime = new Trend('interaction_update_time');
const interactionDeleteTime = new Trend('interaction_delete_time');

const interactionErrors = new Counter('interaction_errors');
const interactionSuccessRate = new Rate('interaction_success_rate');

// Configuration
const BASE_URL = __ENV.API_URL || 'http://localhost:5000';
const AUTH_TOKEN = __ENV.TOKEN || 'Bearer test-token-12345';

// VU Configuration
export const options = {
  vus: 10,
  duration: '30s',
  rps: 100,
  thresholds: {
    'interaction_create_time': ['p(95)<400'],
    'interaction_list_time': ['p(95)<300'],
    'interaction_detail_time': ['p(95)<200'],
    'interaction_stats_time': ['p(95)<500'],
    'interaction_update_time': ['p(95)<400'],
    'interaction_delete_time': ['p(95)<200'],
    'interaction_success_rate': ['>=0.99'],
  },
};

// Test interaction creation
export function testCreateInteraction(customerId = 1) {
  return group('Create Interaction', function() {
    const payload = JSON.stringify({
      customer_id: customerId,
      interaction_type: 'call',
      description: 'Load test interaction',
      status: 'completed',
      interaction_date: new Date().toISOString(),
      notes: `Generated at ${Date.now()}`,
    });

    const res = http.post(
      `${BASE_URL}/api/interactions`,
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': AUTH_TOKEN,
        },
      }
    );

    interactionCreateTime.add(res.timings.duration);
    const success = check(res, {
      'create status is 201': (r) => r.status === 201,
      'has interaction id': (r) => r.json('data.id') !== null,
      'create response time < 400ms': (r) => r.timings.duration < 400,
    });

    if (success) {
      interactionSuccessRate.add(1);
    } else {
      interactionErrors.add(1);
      interactionSuccessRate.add(0);
    }

    return res.json('data.id');
  });
}

// Test get interactions list
export function testGetInteractionsList() {
  return group('Get Interactions List', function() {
    const res = http.get(
      `${BASE_URL}/api/interactions?limit=20&offset=0`,
      {
        headers: {
          'Authorization': AUTH_TOKEN,
        },
      }
    );

    interactionGetListTime.add(res.timings.duration);
    const success = check(res, {
      'get list status is 200': (r) => r.status === 200,
      'has interactions array': (r) => Array.isArray(r.json('data')),
      'list response time < 300ms': (r) => r.timings.duration < 300,
    });

    if (success) {
      interactionSuccessRate.add(1);
    } else {
      interactionErrors.add(1);
      interactionSuccessRate.add(0);
    }

    return res;
  });
}

// Test get interaction detail
export function testGetInteractionDetail(interactionId) {
  return group('Get Interaction Detail', function() {
    if (!interactionId) {
      const listRes = testGetInteractionsList();
      interactionId = listRes.json('data[0].id');
      if (!interactionId) return null;
    }

    const res = http.get(
      `${BASE_URL}/api/interactions/${interactionId}`,
      {
        headers: {
          'Authorization': AUTH_TOKEN,
        },
      }
    );

    interactionGetDetailTime.add(res.timings.duration);
    const success = check(res, {
      'get detail status is 200': (r) => r.status === 200,
      'has interaction type': (r) => r.json('data.interaction_type') !== null,
      'detail response time < 200ms': (r) => r.timings.duration < 200,
    });

    if (success) {
      interactionSuccessRate.add(1);
    } else {
      interactionErrors.add(1);
      interactionSuccessRate.add(0);
    }

    return interactionId;
  });
}

// Test get customer interactions
export function testGetCustomerInteractions(customerId = 1) {
  return group('Get Customer Interactions', function() {
    const res = http.get(
      `${BASE_URL}/api/customers/${customerId}/interactions`,
      {
        headers: {
          'Authorization': AUTH_TOKEN,
        },
      }
    );

    check(res, {
      'customer interactions status 200': (r) => r.status === 200,
      'returns array': (r) => Array.isArray(r.json('data')),
      'response time < 300ms': (r) => r.timings.duration < 300,
    });
  });
}

// Test interaction statistics
export function testInteractionStats() {
  return group('Interaction Statistics', function() {
    const res = http.get(
      `${BASE_URL}/api/interactions/stats`,
      {
        headers: {
          'Authorization': AUTH_TOKEN,
        },
      }
    );

    interactionStatsTime.add(res.timings.duration);
    const success = check(res, {
      'stats status 200': (r) => r.status === 200,
      'has total count': (r) => r.json('data.total_count') !== null,
      'response time < 500ms': (r) => r.timings.duration < 500,
    });

    if (success) {
      interactionSuccessRate.add(1);
    } else {
      interactionErrors.add(1);
      interactionSuccessRate.add(0);
    }
  });
}

// Test update interaction
export function testUpdateInteraction(interactionId) {
  return group('Update Interaction', function() {
    if (!interactionId) {
      interactionId = testGetInteractionDetail();
      if (!interactionId) return;
    }

    const payload = JSON.stringify({
      status: 'completed',
      notes: `Updated at ${Date.now()}`,
    });

    const res = http.put(
      `${BASE_URL}/api/interactions/${interactionId}`,
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': AUTH_TOKEN,
        },
      }
    );

    interactionUpdateTime.add(res.timings.duration);
    const success = check(res, {
      'update status 200': (r) => r.status === 200 || r.status === 201,
      'update response time < 400ms': (r) => r.timings.duration < 400,
    });

    if (success) {
      interactionSuccessRate.add(1);
    } else {
      interactionErrors.add(1);
      interactionSuccessRate.add(0);
    }
  });
}

// Test interaction filtering
export function testInteractionFiltering() {
  return group('Interaction Filtering', function() {
    const filters = [
      '?type=call',
      '?type=email',
      '?status=completed',
      '?status=pending',
      '?limit=10',
      '?sort=interaction_date',
    ];

    for (const filter of filters) {
      const res = http.get(
        `${BASE_URL}/api/interactions${filter}`,
        {
          headers: {
            'Authorization': AUTH_TOKEN,
          },
        }
      );

      check(res, {
        'filter response 200': (r) => r.status === 200,
        'filter returns array': (r) => Array.isArray(r.json('data')),
      });
    }
  });
}

// Main test execution
export default function() {
  // Get list
  testGetInteractionsList();
  sleep(1);

  // Create interaction
  const newInteractionId = testCreateInteraction();
  sleep(1);

  // Get detail
  testGetInteractionDetail(newInteractionId);
  sleep(1);

  // Get customer interactions
  testGetCustomerInteractions(1);
  sleep(1);

  // Get stats
  testInteractionStats();
  sleep(1);

  // Update
  if (newInteractionId) {
    testUpdateInteraction(newInteractionId);
    sleep(1);
  }

  // Filtering
  testInteractionFiltering();
  sleep(1);
}

export function setup() {
  console.log('Interaction Load Test Starting...');
}

export function teardown() {
  console.log('Interaction Load Test Complete');
}
