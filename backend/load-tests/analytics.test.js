/**
 * k6 Load Test: CRM Analytics API
 * Tests performance of analytics endpoints under load
 * 
 * Usage: k6 run analytics.test.js
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Counter, Trend, Rate } from 'k6/metrics';

// Define metrics
const overviewTime = new Trend('analytics_overview_time');
const segmentsTime = new Trend('analytics_segments_time');
const performanceTime = new Trend('analytics_performance_time');
const trendsTime = new Trend('analytics_trends_time');
const revenueTime = new Trend('analytics_revenue_time');

const analyticsErrors = new Counter('analytics_errors');
const analyticsSuccessRate = new Rate('analytics_success_rate');

// Configuration
const BASE_URL = __ENV.API_URL || 'http://localhost:5000';
const AUTH_TOKEN = __ENV.TOKEN || 'Bearer test-token-12345';

// VU Configuration
export const options = {
  vus: 15,
  duration: '30s',
  rps: 150,
  thresholds: {
    'analytics_overview_time': ['p(95)<600'],
    'analytics_segments_time': ['p(95)<800'],
    'analytics_performance_time': ['p(95)<700'],
    'analytics_trends_time': ['p(95)<900'],
    'analytics_revenue_time': ['p(95)<1000'],
    'analytics_success_rate': ['>=0.99'],
  },
};

// Test overview endpoint
export function testOverview() {
  return group('Analytics Overview', function() {
    const res = http.get(
      `${BASE_URL}/api/crm-analytics/overview`,
      {
        headers: {
          'Authorization': AUTH_TOKEN,
        },
      }
    );

    overviewTime.add(res.timings.duration);
    const success = check(res, {
      'overview status 200': (r) => r.status === 200,
      'has metrics': (r) => r.json('data.total_customers') !== null,
      'response time < 600ms': (r) => r.timings.duration < 600,
    });

    if (success) {
      analyticsSuccessRate.add(1);
    } else {
      analyticsErrors.add(1);
      analyticsSuccessRate.add(0);
    }
  });
}

// Test customer segments
export function testCustomerSegments() {
  return group('Customer Segments', function() {
    const filters = ['', '?segment_type=vip', '?limit=10'];

    for (const filter of filters) {
      const res = http.get(
        `${BASE_URL}/api/crm-analytics/customer-segments${filter}`,
        {
          headers: {
            'Authorization': AUTH_TOKEN,
          },
        }
      );

      segmentsTime.add(res.timings.duration);
      check(res, {
        'segments status 200': (r) => r.status === 200,
        'returns array': (r) => Array.isArray(r.json('data')),
        'response time < 800ms': (r) => r.timings.duration < 800,
      });
    }

    analyticsSuccessRate.add(1);
  });
}

// Test campaign performance
export function testCampaignPerformance() {
  return group('Campaign Performance', function() {
    const dateRanges = [
      '?start_date=2025-01-01&end_date=2025-01-31',
      '?start_date=2025-02-01&end_date=2025-02-28',
      '?start_date=2025-03-01&end_date=2025-03-31',
    ];

    for (const range of dateRanges) {
      const res = http.get(
        `${BASE_URL}/api/crm-analytics/campaign-performance${range}`,
        {
          headers: {
            'Authorization': AUTH_TOKEN,
          },
        }
      );

      performanceTime.add(res.timings.duration);
      const success = check(res, {
        'performance status 200': (r) => r.status === 200,
        'has metrics': (r) => r.json('data.average_response_rate') !== null,
        'response time < 700ms': (r) => r.timings.duration < 700,
      });

      if (success) {
        analyticsSuccessRate.add(1);
      } else {
        analyticsErrors.add(1);
        analyticsSuccessRate.add(0);
      }
    }
  });
}

// Test interaction trends
export function testInteractionTrends() {
  return group('Interaction Trends', function() {
    const groupings = ['?group_by=day', '?group_by=week', '?group_by=month'];

    for (const grouping of groupings) {
      const res = http.get(
        `${BASE_URL}/api/crm-analytics/interaction-trends${grouping}`,
        {
          headers: {
            'Authorization': AUTH_TOKEN,
          },
        }
      );

      trendsTime.add(res.timings.duration);
      const success = check(res, {
        'trends status 200': (r) => r.status === 200,
        'returns array': (r) => Array.isArray(r.json('data')),
        'response time < 900ms': (r) => r.timings.duration < 900,
      });

      if (success) {
        analyticsSuccessRate.add(1);
      } else {
        analyticsErrors.add(1);
        analyticsSuccessRate.add(0);
      }
    }
  });
}

// Test revenue insights
export function testRevenueInsights() {
  return group('Revenue Insights', function() {
    const currencies = ['', '?currency=EUR', '?currency=GBP'];

    for (const currency of currencies) {
      const res = http.get(
        `${BASE_URL}/api/crm-analytics/revenue-insights${currency}`,
        {
          headers: {
            'Authorization': AUTH_TOKEN,
          },
        }
      );

      revenueTime.add(res.timings.duration);
      const success = check(res, {
        'revenue status 200': (r) => r.status === 200,
        'has revenue data': (r) => r.json('data.total_revenue') !== null,
        'has predictions': (r) => r.json('data.prediction') !== null,
        'response time < 1000ms': (r) => r.timings.duration < 1000,
      });

      if (success) {
        analyticsSuccessRate.add(1);
      } else {
        analyticsErrors.add(1);
        analyticsSuccessRate.add(0);
      }
    }
  });
}

// Test concurrent analytics load
export function testConcurrentAnalytics() {
  return group('Concurrent Analytics', function() {
    const batch = http.batch([
      ['GET', `${BASE_URL}/api/crm-analytics/overview`],
      ['GET', `${BASE_URL}/api/crm-analytics/customer-segments`],
      ['GET', `${BASE_URL}/api/crm-analytics/campaign-performance`],
      ['GET', `${BASE_URL}/api/crm-analytics/interaction-trends?group_by=day`],
      ['GET', `${BASE_URL}/api/crm-analytics/revenue-insights`],
    ]);

    for (let res of batch) {
      check(res, {
        'batch status 200': (r) => r.status === 200,
        'batch response time < 2s': (r) => r.timings.duration < 2000,
      });
    }
  });
}

// Main test execution
export default function() {
  // Overview
  testOverview();
  sleep(1);

  // Segments
  testCustomerSegments();
  sleep(1);

  // Performance
  testCampaignPerformance();
  sleep(1);

  // Trends
  testInteractionTrends();
  sleep(1);

  // Revenue
  testRevenueInsights();
  sleep(1);

  // Concurrent load
  testConcurrentAnalytics();
  sleep(1);
}

export function setup() {
  console.log('Analytics Load Test Starting...');
}

export function teardown() {
  console.log('Analytics Load Test Complete');
}
