/**
 * k6 Load Test: Campaign API
 * Tests performance of campaign endpoints under load
 * 
 * Usage: k6 run campaigns.test.js
 * With options: k6 run -u 50 -d 60s campaigns.test.js
 *   -u 50: 50 concurrent users
 *   -d 60s: 60 second test duration
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Counter, Trend, Rate } from 'k6/metrics';

// Define metrics
const campaignCreateTime = new Trend('campaign_create_time');
const campaignGetListTime = new Trend('campaign_list_time');
const campaignGetDetailTime = new Trend('campaign_detail_time');
const campaignUpdateTime = new Trend('campaign_update_time');
const campaignDeleteTime = new Trend('campaign_delete_time');

const campaignErrors = new Counter('campaign_errors');
const campaignSuccessRate = new Rate('campaign_success_rate');

// Configuration
const BASE_URL = __ENV.API_URL || 'http://localhost:5000';
const AUTH_TOKEN = __ENV.TOKEN || 'Bearer test-token-12345';

// VU Configuration
export const options = {
  vus: 10,                          // 10 concurrent users
  duration: '30s',                  // 30 second test
  rps: 100,                         // Max 100 requests per second
  thresholds: {
    'campaign_create_time': ['p(95)<500'],    // p95 < 500ms
    'campaign_list_time': ['p(95)<300'],      // p95 < 300ms  
    'campaign_detail_time': ['p(95)<200'],    // p95 < 200ms
    'campaign_update_time': ['p(95)<400'],    // p95 < 400ms
    'campaign_delete_time': ['p(95)<200'],    // p95 < 200ms
    'campaign_success_rate': ['>=0.99'],      // 99%+ success rate
  },
};

// Test campaign creation
export function testCreateCampaign(campaignName) {
  return group('Create Campaign', function() {
    const payload = JSON.stringify({
      name: campaignName || `Campaign-${Date.now()}`,
      description: 'Test campaign for load testing',
      status: 'active',
      start_date: '2025-04-01',
      end_date: '2025-04-30',
      budget: 10000,
      target_audience: 'all',
    });

    const res = http.post(
      `${BASE_URL}/api/campaigns`,
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': AUTH_TOKEN,
        },
      }
    );

    campaignCreateTime.add(res.timings.duration);
    const success = check(res, {
      'create status is 201': (r) => r.status === 201,
      'has campaign id': (r) => r.json('data.id') !== null,
      'create response time < 500ms': (r) => r.timings.duration < 500,
    });

    if (success) {
      campaignSuccessRate.add(1);
    } else {
      campaignErrors.add(1);
      campaignSuccessRate.add(0);
    }

    return res.json('data.id');
  });
}

// Test get campaigns list
export function testGetCampaignsList() {
  return group('Get Campaigns List', function() {
    const res = http.get(
      `${BASE_URL}/api/campaigns?limit=10&offset=0`,
      {
        headers: {
          'Authorization': AUTH_TOKEN,
        },
      }
    );

    campaignGetListTime.add(res.timings.duration);
    const success = check(res, {
      'get list status is 200': (r) => r.status === 200,
      'has campaigns array': (r) => Array.isArray(r.json('data')),
      'list response time < 300ms': (r) => r.timings.duration < 300,
    });

    if (success) {
      campaignSuccessRate.add(1);
    } else {
      campaignErrors.add(1);
      campaignSuccessRate.add(0);
    }

    return res;
  });
}

// Test get campaign detail
export function testGetCampaignDetail(campaignId) {
  return group('Get Campaign Detail', function() {
    if (!campaignId) {
      // Get a campaign first
      const listRes = testGetCampaignsList();
      campaignId = listRes.json('data[0].id');
      if (!campaignId) {
        return null;
      }
    }

    const res = http.get(
      `${BASE_URL}/api/campaigns/${campaignId}`,
      {
        headers: {
          'Authorization': AUTH_TOKEN,
        },
      }
    );

    campaignGetDetailTime.add(res.timings.duration);
    const success = check(res, {
      'get detail status is 200': (r) => r.status === 200,
      'has campaign name': (r) => r.json('data.name') !== null,
      'detail response time < 200ms': (r) => r.timings.duration < 200,
    });

    if (success) {
      campaignSuccessRate.add(1);
    } else {
      campaignErrors.add(1);
      campaignSuccessRate.add(0);
    }

    return campaignId;
  });
}

// Test update campaign
export function testUpdateCampaign(campaignId) {
  return group('Update Campaign', function() {
    if (!campaignId) {
      campaignId = testGetCampaignDetail();
      if (!campaignId) return;
    }

    const payload = JSON.stringify({
      name: `Updated-${Date.now()}`,
      description: 'Updated during load test',
      status: 'active',
    });

    const res = http.put(
      `${BASE_URL}/api/campaigns/${campaignId}`,
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': AUTH_TOKEN,
        },
      }
    );

    campaignUpdateTime.add(res.timings.duration);
    const success = check(res, {
      'update status is 200': (r) => r.status === 200 || r.status === 201,
      'has updated data': (r) => r.json('data.id') !== null,
      'update response time < 400ms': (r) => r.timings.duration < 400,
    });

    if (success) {
      campaignSuccessRate.add(1);
    } else {
      campaignErrors.add(1);
      campaignSuccessRate.add(0);
    }
  });
}

// Test delete campaign
export function testDeleteCampaign(campaignId) {
  return group('Delete Campaign', function() {
    if (!campaignId) {
      campaignId = testGetCampaignDetail();
      if (!campaignId) return;
    }

    const res = http.del(
      `${BASE_URL}/api/campaigns/${campaignId}`,
      {
        headers: {
          'Authorization': AUTH_TOKEN,
        },
      }
    );

    campaignDeleteTime.add(res.timings.duration);
    const success = check(res, {
      'delete status is 200 or 204': (r) => r.status === 200 || r.status === 204,
      'delete response time < 200ms': (r) => r.timings.duration < 200,
    });

    if (success) {
      campaignSuccessRate.add(1);
    } else {
      campaignErrors.add(1);
      campaignSuccessRate.add(0);
    }
  });
}

// Test campaign filtering
export function testCampaignFiltering() {
  return group('Campaign Filtering', function() {
    const filters = [
      '?status=active',
      '?status=inactive',
      '?limit=5',
      '?offset=10',
      '?sort=created_at',
    ];

    for (const filter of filters) {
      const res = http.get(
        `${BASE_URL}/api/campaigns${filter}`,
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
  // Warm-up: Get list
  testGetCampaignsList();
  sleep(1);

  // Create campaign
  const newCampaignId = testCreateCampaign();
  sleep(1);

  // Get detail
  testGetCampaignDetail(newCampaignId);
  sleep(1);

  // Update
  if (newCampaignId) {
    testUpdateCampaign(newCampaignId);
    sleep(1);
  }

  // Filtering tests
  testCampaignFiltering();
  sleep(1);

  // Delete (comment out to preserve test data)
  // if (newCampaignId) {
  //   testDeleteCampaign(newCampaignId);
  //   sleep(1);
  // }
}

// Setup: Run once at start
export function setup() {
  console.log('Campaign Load Test Starting...');
  console.log(`Target: ${BASE_URL}`);
  console.log(`VUs: ${options.vus}`);
  console.log(`Duration: ${options.duration}`);
}

// Teardown: Run once at end
export function teardown(data) {
  console.log('Campaign Load Test Complete');
}
