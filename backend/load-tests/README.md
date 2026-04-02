# k6 Load Testing - Setup Guide

## What is k6?

k6 is a modern load testing framework that allows you to test your APIs under realistic user load conditions. It uses JavaScript for test scripting and provides metrics-based thresholds to automatically fail tests when performance degrades.

**Key Benefits**:
- Simple JavaScript syntax for test scripts
- Built-in metrics and custom metrics support
- Real-time visualization of results
- Threshold-based pass/fail criteria
- Distributed testing capabilities

---

## Installation

### Windows

#### Option 1: Using Chocolatey (Recommended)
```powershell
choco install k6
```

#### Option 2: Direct Download
1. Visit: https://github.com/grafana/k6/releases
2. Download the Windows binary
3. Add to PATH

#### Option 3: Using npm (if available)
```bash
npm install -g @k6io/browser
```

### macOS
```bash
brew install k6
```

### Linux
```bash
# Ubuntu/Debian
sudo apt-get install k6

# RHEL/CentOS
sudo dnf install k6

# Or using docker
docker pull grafana/k6:latest
```

### Verify Installation
```bash
k6 version
```

---

## Running Tests

### Basic Syntax
```bash
k6 run script.js
```

### With Options
```bash
# Specify users and duration
k6 run -u 50 -d 30s campaigns.test.js

# Set environment variables
k6 run --env API_URL=http://localhost:5000 campaigns.test.js

# Run with output format
k6 run --out json=results.json campaigns.test.js

# Run with v (verbose)
k6 run -v campaigns.test.js
```

### Common Flags
```
-u, --vus NUM              Number of concurrent users
-d, --duration DURATION    Test duration (30s, 5m, etc)
--rps NUM                  Max requests per second
--out FORMAT               Output format (json, csv, etc)
--env KEY=VALUE            Environment variable
-v, --verbose              Verbose output
-q, --quiet                Quiet output
```

---

## Test Files Overview

### 1. campaigns.test.js
**Focus**: Campaign CRUD operations and filtering  
**Load**: 10 VUs for 30 seconds  
**Operations**:
- List campaigns (with filtering, pagination)
- Create campaign
- Get campaign detail
- Update campaign
- Delete campaign

**Run**:
```bash
k6 run backend/load-tests/campaigns.test.js
```

---

### 2. interactions.test.js
**Focus**: Interaction CRUD and customer relationships  
**Load**: 10 VUs for 30 seconds  
**Operations**:
- List interactions
- Create interaction
- Get detail
- Get customer interactions
- Get statistics
- Update/delete

**Run**:
```bash
k6 run backend/load-tests/interactions.test.js
```

---

### 3. analytics.test.js
**Focus**: Heavy analytics and aggregation queries  
**Load**: 15 VUs for 30 seconds (higher load due to heavier operations)  
**Operations**:
- Overview metrics
- Customer segmentation
- Campaign performance
- Interaction trends (daily, weekly, monthly)
- Revenue insights

**Run**:
```bash
k6 run backend/load-tests/analytics.test.js
```

---

### 4. sync.test.js
**Focus**: Integration and sync operations  
**Load**: 5 VUs for 30 seconds (lower load - more expensive)  
**Operations**:
- Sync status checks
- Individual entity sync (customers, campaigns, etc)
- Integration health checks
- Data comparison
- Sync logs

**Run**:
```bash
k6 run backend/load-tests/sync.test.js
```

---

### 5. mixed-load.test.js
**Focus**: Realistic user patterns combining all endpoints  
**Load**: 20 VUs for 60 seconds  
**Scenarios**:
- 35% browsing (campaigns, interactions)
- 25% viewing analytics
- 20% creating/updating
- 20% checking sync status

**Run**:
```bash
k6 run backend/load-tests/mixed-load.test.js
```

The load is distributed based on realistic usage patterns.

---

### 6. stress-test.js
**Focus**: Finding system limits with gradually increasing load  
**Load**: Ramps from 10 to 100 VUs over 8 minutes, then ramps down  
**Stages**:
- 0-2min: 10 VUs (ramp-up)
- 2-4min: 20 VUs
- 4-6min: 50 VUs
- 6-8min: 100 VUs (peak)
- 8-11min: 100 VUs (hold - find breaking point)
- 11-13min: 50 VUs (ramp-down)
- 13-15min: 0 VUs (cool-down)

**Run**:
```bash
k6 run backend/load-tests/stress-test.js
```

---

## Test Execution Plans

### Plan 1: Quick Sanity Check (5 minutes)
Test basic functionality under light load:

```bash
# Terminal 1: Run campaigns test
k6 run backend/load-tests/campaigns.test.js

# Terminal 2: Run interactions test
k6 run backend/load-tests/interactions.test.js

# Terminal 3: Run analytics test
k6 run backend/load-tests/analytics.test.js
```

---

### Plan 2: Realistic Load Testing (20 minutes)
Simulate real user behavior:

```bash
# Run this script:
k6 run -u 20 -d 10m backend/load-tests/mixed-load.test.js
```

This will:
- Start with 20 concurrent users
- Run for 10 minutes
- Simulate realistic usage patterns
- Collect metrics on success rate and response times

---

### Plan 3: Stress Testing (15 minutes)
Find system limits:

```bash
# Run stress test with ramping load
k6 run backend/load-tests/stress-test.js
```

This will gradually increase load to 100 concurrent users to identify breaking points.

---

### Plan 4: Full Suite (1 hour)
Complete performance validation:

```bash
# Run all tests in sequence

echo "1. Campaign tests..."
k6 run backend/load-tests/campaigns.test.js

echo "2. Interaction tests..."
k6 run backend/load-tests/interactions.test.js

echo "3. Analytics tests..."
k6 run backend/load-tests/analytics.test.js

echo "4. Sync tests..."
k6 run backend/load-tests/sync.test.js

echo "5. Mixed load test..."
k6 run -d 5m backend/load-tests/mixed-load.test.js

echo "6. Stress test..."
k6 run backend/load-tests/stress-test.js

echo "Complete!"
```

---

## Reading Test Output

### Key Metrics

**Response Time Metrics**:
```
http_req_duration.........: avg=245.6ms p(90)=456.3ms p(95)=534.2ms p(99)=892.1ms
```
- `avg`: Average response time
- `p(90)`: 90th percentile (90% of requests faster than this)
- `p(95)`: 95th percentile - performance target
- `p(99)`: 99th percentile - worst case

**Success Metrics**:
```
http_reqs..................: 1234 req/s
http_req_failed............: 0.5%   ✗
http_req_blocked...........: avg=1.2ms
http_req_connecting........: avg=0.8ms
http_req_tls_handshaking...: avg=0ms
http_req_sending...........: avg=2.1ms
http_req_waiting...........: avg=245ms ← Server processing time
http_req_receiving.........: avg=5.2ms
```

**Custom Metrics** (from our tests):
```
campaign_create_time........: avg=318ms p(95)=456ms
campaign_list_time..........: avg=182ms p(95)=298ms
campaign_success_rate.......: 99.2%
```

---

## Performance Targets

These are the thresholds configured in each test:

### Campaign API
- p95 create: < 500ms ✅
- p95 list: < 300ms ✅
- p95 detail: < 200ms ✅
- p95 update: < 400ms ✅
- p95 delete: < 200ms ✅
- Success rate: ≥ 99% ✅

### Interaction API
- p95 create: < 400ms ✅
- p95 list: < 300ms ✅
- p95 detail: < 200ms ✅
- p95 stats: < 500ms ✅
- Success rate: ≥ 99% ✅

### Analytics API
- p95 overview: < 600ms ✅
- p95 segments: < 800ms ✅
- p95 performance: < 700ms ✅
- p95 trends: < 900ms ✅
- p95 revenue: < 1000ms ✅
- Success rate: ≥ 99% ✅

### Sync/Integration API
- p95 status: < 500ms ✅
- p95 execute: < 2000ms ✅
- p95 logs: < 600ms ✅
- p95 health: < 300ms ✅
- p95 compare: < 1000ms ✅
- Success rate: ≥ 95% ✅

### Mixed Load (Realistic)
- http_req_duration p(95): < 500ms ✅
- http_req_duration p(99): < 1000ms ✅
- Success rate: ≥ 95% ✅

---

## Advanced: Custom Metrics

Our tests use custom metrics to track performance:

```javascript
// Define custom metrics
const campaignCreateTime = new Trend('campaign_create_time');
const campaignSuccessRate = new Rate('campaign_success_rate');
const campaignErrors = new Counter('campaign_errors');

// Record metrics
campaignCreateTime.add(res.timings.duration);
res.status === 201 ? successRate.add(1) : successRate.add(0);
```

### Metric Types:
- **Trend**: Tracks numeric values (response times, sizes)
- **Rate**: Tracks success/failure percentage (0-1)
- **Counter**: Counts occurrences (errors, requests)
- **Gauge**: Tracks a single numeric value (active connections)

---

## Troubleshooting

### Test Fails on Connection
```bash
# Check if API is running
curl http://localhost:5000/api/campaigns

# Run test with specific API URL
k6 run --env API_URL=http://your-api:5000 campaigns.test.js
```

### Authentication Errors (401)
```bash
# Update the AUTH_TOKEN in test files or pass via env
k6 run --env TOKEN="Bearer your-token" campaigns.test.js
```

### Out of Memory
- Reduce VUs
- Reduce test duration
- Run tests individually instead of in parallel

```bash
# Reduce load
k6 run -u 3 -d 10s campaigns.test.js
```

---

## Next Steps

1. **First Run**: Run a simple test to verify setup
   ```bash
   k6 run backend/load-tests/campaigns.test.js
   ```

2. **Baseline**: Run all tests to get baseline metrics
   ```bash
   for test in backend/load-tests/*.test.js; do
     echo "Running $test..."
     k6 run "$test"
     sleep 5
   done
   ```

3. **Optimization**: 
   - Note which endpoints are slowest
   - Apply database indexes
   - Implement caching

4. **Retest**: Run tests again to verify improvements
   - Expect 30-50% improvement after caching
   - Expect 20-30% improvement after indexing

5. **Monitor**: Set up continuous monitoring
   - Run load tests regularly
   - Alert on performance degradation

---

## Additional Resources

- k6 Documentation: https://k6.io/docs/
- Grafana Cloud: https://grafana.com/products/cloud/
- k6 Community: https://community.grafana.com/c/k6/

---

## Test File Organization

```
backend/load-tests/
├── campaigns.test.js      # Campaign CRUD tests
├── interactions.test.js    # Interaction CRUD tests
├── analytics.test.js       # Analytics & aggregation tests
├── sync.test.js            # Integration & sync tests
├── mixed-load.test.js      # Realistic user patterns
├── stress-test.js          # Ramping load to breaking point
└── README.md               # This file
```

---

## Environment Variables

Pass via command line:
```bash
k6 run --env API_URL=http://localhost:5000 --env TOKEN="Bearer xyz" campaigns.test.js
```

Or in test file:
```javascript
const BASE_URL = __ENV.API_URL || 'http://localhost:5000';
const AUTH_TOKEN = __ENV.TOKEN || 'Bearer test-token';
```

---

**Ready to test?** Start with: `k6 run backend/load-tests/campaigns.test.js`
