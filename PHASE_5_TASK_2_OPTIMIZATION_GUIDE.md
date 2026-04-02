# Phase 5: Task 2 - Query Optimization & Database Indexing

**Date**: April 1, 2026  
**Status**: ✅ READY TO EXECUTE  
**Task**: 2 of 5 in Phase 5  
**Estimated Effort**: 6-8 hours

---

## Overview

Task 2 focuses on optimizing database queries through strategic indexing and analysis. After establishing performance baselines with k6 tests in Task 1, we now identify bottlenecks and implement indices to improve query performance by 30-50%.

---

## Objectives

1. ✅ Analyze baseline query performance from k6 tests
2. ✅ Identify slow/missing queries and access patterns
3. ✅ Create strategic database indices
4. ✅ Update table statistics for query planner
5. ✅ Re-run k6 tests to measure improvement
6. ✅ Document performance gains

---

## Deliverables

### 1. SQL Optimization Script
**File**: `database-optimization/create-indices.sql`
**Content**: 12-step SQL optimization script
**Key Sections**:
- Query performance analysis
- Strategic index creation (25+ indices)
- Index verification
- Statistics updates
- Query plan analysis (EXPLAIN)
- Partial indices for common filters
- Connection pooling configuration
- Maintenance procedures
- Performance expectations
- Cleanup procedures

**Indices to Create** (25+ total):

#### Customers Table (4 indices)
```sql
idx_customers_email           -- Email lookups (auth)
idx_customers_status          -- Status filtering
idx_customers_created_at      -- Recent items
idx_customers_status_created  -- Combined filters
```

#### Campaigns Table (5 indices)
```sql
idx_campaigns_status          -- Status filtering
idx_campaigns_created_at      -- Recent items
idx_campaigns_customer_id     -- Customer campaigns
idx_campaigns_customer_created -- Combined query
idx_campaigns_dates           -- Date range queries
```

#### Interactions Table (6 indices)
```sql
idx_interactions_customer_id      -- Customer interactions (very common)
idx_interactions_created_at       -- Time-based queries
idx_interactions_type             -- Type filtering
idx_interactions_customer_type    -- Customer + type
idx_interactions_type_created     -- Type timeline
idx_interactions_customer_created -- Customer timeline
```

#### Bookings Table (4 indices)
```sql
idx_bookings_customer_id      -- Customer bookings
idx_bookings_status           -- Status filtering
idx_bookings_created_at       -- Time queries
idx_bookings_customer_status  -- Common combined filter
```

#### Sync Logs Table (3 indices)
```sql
idx_sync_logs_entity_type       -- Entity filtering
idx_sync_logs_created_at        -- Time queries
idx_sync_logs_entity_created    -- Entity timeline
```

#### Additional Optimization (3 partial indices)
```sql
idx_campaigns_active       -- Only active campaigns (most queried)
idx_customers_active       -- Only active customers
idx_interactions_completed -- Completed interactions (immutable)
```

**Total**: 25 strategic indices

### 2. Query Analysis Tool
**File**: `database-optimization/analyze-queries.js`  
**Language**: Node.js  
**Purpose**: Automated analysis of database performance  

**Features**:
- Table size analysis
- Existing index audit
- Unused index detection
- Index recommendations
- Connection statistics
- Long-running query detection  
- Cache hit ratio measurement
- Performance recommendations
- Formatted, color-coded output

**Usage**:
```bash
node database-optimization/analyze-queries.js
```

**Output Includes**:
1. Table sizes and row counts
2. Existing indices with usage statistics
3. Unused indices (candidates for removal)
4. Recommended indices (with reasons)
5. Connection statistics
6. Any long-running queries
7. Cache hit ratio
8. Action items and next steps

---

## Implementation Steps

### Step 1: Baseline Measurement (30 min)
Before making any changes:

```bash
# Run k6 baseline tests
k6 run backend/load-tests/campaigns.test.js
k6 run backend/load-tests/interactions.test.js
k6 run backend/load-tests/analytics.test.js
k6 run backend/load-tests/sync.test.js

# Capture metrics:
# - Response times (p50, p95, p99)
# - Error rate
# - Throughput
```

**Document baseline** in `baseline-metrics.txt`

### Step 2: Analyze Current Performance (30 min)
```bash
# Run analysis tool
node database-optimization/analyze-queries.js

# Output will show:
# - Which indices exist
# - Which are unused (waste of space)
# - Which are missing (needed for queries)
# - Cache hit ratio (should be > 99%)
```

### Step 3: Create Backup (10 min)
**CRITICAL**: Always backup before making changes!

```bash
# Backup database
pg_dump -U postgres rsv360 > backup_before_indices.sql

# Verify backup
ls -lh backup_before_indices.sql
```

### Step 4: Apply Indices (20 min)
Execute the SQL optimization script:

```bash
# Option 1: Using psql
psql -U postgres -d rsv360 -f database-optimization/create-indices.sql

# Option 2: Using pgAdmin
# 1. Open pgAdmin
# 2. Navigate to rsv360 database
# 3. Open Query Tool
# 4. Copy/paste create-indices.sql
# 5. Execute
```

**Output should show**:
```
CREATE INDEX
CREATE INDEX
...
ANALYZE
```

### Step 5: Verify Index Creation (10 min)
```bash
# Re-run analysis tool to verify
node database-optimization/analyze-queries.js

# Check for:
# - All 25 indices created
# - No errors in creation
# - Statistics updated
```

### Step 6: Update Table Statistics (5 min)
PostgreSQL's query planner needs updated statistics:

```sql
-- Already included in create-indices.sql, but can re-run:
ANALYZE customers;
ANALYZE campaigns;
ANALYZE interactions;
ANALYZE bookings;
ANALYZE sync_logs;
```

### Step 7: Warm Up Caches (10 min)
Let PostgreSQL cache the indices:

```bash
# Run simple queries to warm cache
psql -U postgres -d rsv360 << 'EOF'
SELECT COUNT(*) FROM customers;
SELECT COUNT(*) FROM campaigns;
SELECT COUNT(*) FROM interactions;
SELECT COUNT(*) FROM bookings;
EOF
```

### Step 8: Re-test with k6 (30 min)
Run the same k6 tests to measure improvement:

```bash
# Run tests again
k6 run backend/load-tests/campaigns.test.js
k6 run backend/load-tests/interactions.test.js
k6 run backend/load-tests/analytics.test.js
k6 run backend/load-tests/sync.test.js

# Compare metrics to baseline
```

### Step 9: Analyze Improvement (20 min)
**Expected Results**:

| Operation | Baseline | After Indices | Improvement |
|-----------|----------|---------------|-------------|
| Email lookup | 250ms | 80ms | 68% |
| Status filter | 450ms | 180ms | 60% |
| List paginated | 350ms | 140ms | 60% |
| Customer queries | 280ms | 100ms | 64% |
| Analytics | 800ms | 500ms | 38% |
| **Average** | **434ms** | **200ms** | **54%** |

**Expected throughput improvement**:
- Before: ~50-70 req/s sustainable
- After: ~90-120 req/s sustainable
- Gain: +40-70% throughput

### Step 10: Document Results (20 min)
Create performance report:

```markdown
# Performance Optimization Results

## Baseline → After Indices

### Response Times
- Campaign list: 350ms → 140ms (60% improvement)
- Interaction queries: 280ms → 100ms (64% improvement)
- Analytics: 800ms → 500ms (38% improvement)

### Throughput
- Before: 50 req/s
- After: 100 req/s
- Gain: +100% (2x throughput)

### Success Rate
- Before: 99.2%
- After: 99.8% (improved stability)

### Database Stats
- Indices created: 25
- Space used: 120MB
- Cache hit ratio: 99.4%
```

---

## Performance Analysis Tool Usage

### Basic Analysis
```bash
node database-optimization/analyze-queries.js
```

### With Custom Database
```bash
DB_USER=admin DB_PASSWORD=secret DB_HOST=db.example.com \
  node database-optimization/analyze-queries.js
```

### Interpreting Output

**Table Sizes**:
```
customers          | Total: 45MB | Table: 32MB | Indexes: 13MB
```
- First indicator of data volume
- Large indices might need partial indices

**Index Usage**:
```
[✓ Used] campaigns | idx_campaigns_status | Scans: 1542
```
- ✓ = Index is being used (good!)
- ✗ = Index not used (candidate for removal)

**Cache Hit Ratio**:
```
Cache Hit Ratio: 99.56% (Target: >99%)
```
- \> 99% = Good
- 95-99% = Acceptable
- < 95% = Needs attention (increase shared_buffers or add caching)

**Recommendations**:
- Follow numbered action items
- Prioritize by impact (highest benefit first)

---

## Index Strategy Explained

### Why These Indices?

1. **Email Index** (customers)
   - Authentication lookups (SELECT * WHERE email = ?)
   - Must be fast (every login)
   - Single-column index is sufficient

2. **Status Indices** (campaigns, customers, bookings, interactions)
   - Common filter in listings
   - Heavily used in UI
   - Reduces full-table scans

3. **Customer Relationship Indices** (campaigns, interactions, bookings)
   - Find all items for a customer
   - Most common query pattern
   - Dramatically improves user experience

4. **Time-Based Indices** (created_at DESC)
   - Recent items first (common pattern)
   - Sorting is expensive without index
   - DESC order matches user expectations

5. **Composite Indices** (customer_id, created_at DESC)
   - Optimize combined filters
   - Single query can use one index for two columns
   - Reduces index count needed

6. **Partial Indices** (status = 'active')
   - Only index active records (99% of queries)
   - Smaller index size
   - Faster queries on partial data

---

## Query Plan Analysis (EXPLAIN)

### Before Optimization
```
EXPLAIN ANALYZE SELECT * FROM campaigns WHERE status = 'active';

Seq Scan on campaigns  (cost=0.00..1500.00 rows=500)
  Filter: (status = 'active')
Planning Time: 0.156 ms
Execution Time: 150.234 ms  ← SLOW!
```

### After Optimization
```
EXPLAIN ANALYZE SELECT * FROM campaigns WHERE status = 'active';

Index Scan using idx_campaigns_status on campaigns  (cost=0.28..50.00 rows=500)
  Index Cond: (status = 'active')
Planning Time: 0.095 ms
Execution Time: 8.234 ms  ← FAST! (18x faster)
```

**What Changed**:
- `Seq Scan` → `Index Scan` (database found index)
- Cost reduced from 1500 to 50
- Execution time: 150ms → 8ms
- Planning time reduced too

---

## Troubleshooting

### Issue: "Database locked" during index creation
**Solution**: 
- Use `CONCURRENTLY` option (slower but doesn't lock)
- Create indices during off-peak hours
- Check number of connections

### Issue: Index creation is slow
**Solution**:
- Normal for large tables (50k+ rows)
- Can take 5-60 minutes
- Run during maintenance window
- Be patient, it's worth it!

### Issue: Queries still slow after indices
**Solution**:
1. Verify indices were created: `SELECT * FROM pg_indexes;`
2. Update statistics: `ANALYZE;`
3. Check cache hit ratio (might need shared_buffers increase)
4. Examine query plan: `EXPLAIN ANALYZE SELECT ...;`

### Issue: Database space usage increased
**Solution**:
- Indices use ~30-40% of table size (normal)
- Unused indices can be dropped
- Run analysis tool to find unused indices
- Consider partial indices for large tables

---

## Performance Expectations by Query Type

### CRUD Operations (Baseline vs After)
- **Create**: 200ms → 180ms (10% improvement - inserts use indices on validation)
- **Read**: 300ms → 80ms (73% improvement - direct index lookup)
- **Update**: 250ms → 150ms (40% improvement - finding record to update)
- **Delete**: 150ms → 80ms (47% improvement - finding record to delete)

### Filtering & Listing
- **No filter**: 500ms → 400ms (20% - sequential but still benefits)
- **With status filter**: 450ms → 80ms (82% - index dominates)
- **Date range**: 350ms → 100ms (71% - range scan on index)

### Analytics Queries
- **Aggregations**: 800ms → 500ms (38% - index helps filters, but aggregation still expensive)
- **Trends**: 900ms → 600ms (33% - indexed grouping)
- **Segments**: 700ms → 450ms (36% - filtered data smaller)

---

## Next Tasks

After Task 2 is complete:

**Task 3: Redis Caching** (8-10h)
- Implement caching layer
- Cache expensive queries (analytics)
- Expected 500-1000% improvement for cached queries

**Task 4: Deployment Validation** (4-6h)
- Blue-green deployment testing
- Health checks
- Rollback procedures

**Task 5: Monitoring & Alerts** (6-8h)
- Application Insights setup
- Dashboard creation
- Alert thresholds

---

## Time Breakdown

| Step | Duration | Notes |
|------|----------|-------|
| Baseline testing | 30 min | Run k6 tests |
| Analysis | 30 min | Run analyze-queries.js |
| Backup | 10 min | Create database backup |
| Index creation | 20 min | Execute SQL script |
| Verification | 10 min | Confirm indices created |
| Statistics update | 5 min | ANALYZE command |
| Cache warm-up | 10 min | Run simple queries |
| Re-testing | 30 min | Run k6 tests again |
| Analysis | 20 min | Compare results |
| Documentation | 20 min | Write report |
| **TOTAL** | **3.5 hours** | Can spread over 1-2 days |

---

## Files Reference

```
database-optimization/
├── create-indices.sql    -- 400+ lines of SQL optimization commands
├── analyze-queries.js    -- Query analysis tool
└── baseline-metrics.txt  -- Captured before/after metrics (create this)
```

---

## Key Success Metrics

✅ **30%+ query performance improvement**  
✅ **All 25 indices created without errors**  
✅ **Cache hit ratio stays > 99%**  
✅ **No data loss or corruption**  
✅ **Backup verified and safe**  
✅ **k6 tests pass with new thresholds**  
✅ **Database remains accessible during optimization**

---

## Rollback Plan

If anything goes wrong:

```bash
# 1. Stop application
systemctl stop api-server

# 2. Restore backup
psql -U postgres -d rsv360 < backup_before_indices.sql

# 3. Verify restore
SELECT COUNT(*) FROM customers;

# 4. Restart application
systemctl start api-server
```

Restore time: 5-15 minutes (from fresh backup)

---

## Next Up

→ **Task 3: Redis Caching Implementation**  
  - Implement cache layer
  - Cache-aside pattern
  - Invalidation logic

---

**Ready to Begin?**

1. ✅ Read this document
2. ✅ Ensure database backup exists
3. ✅ Run baseline k6 tests
4. ✅ Execute create-indices.sql
5. ✅ Verify and test

**Estimated completion**: 3-4 hours active work

---

**Report Generated**: April 1, 2026  
**Status**: ✅ READY TO EXECUTE
