/**
 * Query Performance Analyzer
 * 
 * Analyzes PostgreSQL queries and recommends optimizations
 * Run this after baseline k6 tests to identify slow queries
 * 
 * Usage: node analyze-queries.js
 */

const { Client } = require('pg');

const client = new Client({
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '290491Bb',
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'rsv360',
});

// ANSI colors for output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(color, ...args) {
  console.log(`${color}`, ...args, colors.reset);
}

async function analyzeQueries() {
  try {
    await client.connect();
    log(colors.cyan, '═══════════════════════════════════════════════════');
    log(colors.cyan, '  PostgreSQL Query Performance Analysis');
    log(colors.cyan, '═══════════════════════════════════════════════════\n');

    // 1. Table Sizes
    log(colors.blue, '\n1. TABLE SIZES:');
    log(colors.blue, '─────────────────────────────────────────────────────');
    
    const tableSizes = await client.query(`
      SELECT 
        tablename,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
        pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table_size,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - 
                      pg_relation_size(schemaname||'.'||tablename)) as indexes_size,
        (SELECT count(*) FROM ${tablename}) as rows
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
    `);

    for (const row of tableSizes.rows) {
      console.log(`
  ${row.tablename.padEnd(20)} | Total: ${row.total_size.padEnd(10)} | Table: ${row.table_size.padEnd(10)} | Indexes: ${row.indexes_size.padEnd(10)} | Rows: ${row.rows}`);
    }

    // 2. Index Analysis
    log(colors.blue, '\n2. EXISTING INDICES:');
    log(colors.blue, '─────────────────────────────────────────────────────');

    const indices = await client.query(`
      SELECT 
        tablename,
        indexname,
        pg_size_pretty(pg_relation_size(indexrelid)) as size,
        idx_scan as scans,
        idx_tup_read as tuples_read,
        idx_tup_fetch as tuples_fetched
      FROM pg_stat_user_indexes
      ORDER BY pg_relation_size(indexrelid) DESC;
    `);

    for (const row of indices.rows) {
      const usage = row.scans > 0 ? '✓ Used' : '✗ Unused';
      const usageColor = row.scans > 0 ? colors.green : colors.red;
      console.log(`
  ${row.tablename.padEnd(15)} | ${row.indexname.padEnd(30)} | Size: ${row.size.padEnd(8)} | Scans: ${row.scans.toString().padEnd(6)} [${usageColor}${usage}${colors.reset}]`);
    }

    // 3. Unused Indices
    log(colors.yellow, '\n3. UNUSED INDICES (Candidates for Removal):');
    log(colors.yellow, '─────────────────────────────────────────────────────');

    const unusedIndices = await client.query(`
      SELECT 
        tablename,
        indexname,
        pg_size_pretty(pg_relation_size(indexrelid)) as size
      FROM pg_stat_user_indexes
      WHERE idx_scan = 0
      ORDER BY pg_relation_size(indexrelid) DESC;
    `);

    if (unusedIndices.rows.length === 0) {
      console.log('\n  ✓ No unused indices found!');
    } else {
      for (const row of unusedIndices.rows) {
        console.log(`
  ${row.tablename.padEnd(15)} | ${row.indexname.padEnd(30)} | Size: ${row.size}`);
      }
      log(colors.yellow, '\n  Recommendation: Consider removing unused indices to save space');
    }

    // 4. Missing Indices Recommendations
    log(colors.blue, '\n4. RECOMMENDED INDICES:');
    log(colors.blue, '─────────────────────────────────────────────────────');

    const recommendations = [
      {
        table: 'customers',
        index: 'idx_customers_email',
        reason: 'Email-based lookups (authentication)',
      },
      {
        table: 'customers',
        index: 'idx_customers_status',
        reason: 'Status filtering (common filter)',
      },
      {
        table: 'campaigns',
        index: 'idx_campaigns_customer_id',
        reason: 'Customer campaign lookups',
      },
      {
        table: 'campaigns',
        index: 'idx_campaigns_status',
        reason: 'Status-based filtering',
      },
      {
        table: 'interactions',
        index: 'idx_interactions_customer_id',
        reason: 'Customer interaction lookups (very common)',
      },
      {
        table: 'interactions',
        index: 'idx_interactions_created_at',
        reason: 'Time-based queries and recent items',
      },
      {
        table: 'bookings',
        index: 'idx_bookings_customer_id',
        reason: 'Customer booking lookups',
      },
    ];

    for (const rec of recommendations) {
      const checkResult = await client.query(`
        SELECT 1 FROM pg_indexes 
        WHERE tablename = '${rec.table}' 
        AND indexname = '${rec.index}';
      `);

      const status = checkResult.rows.length > 0 ? '✓' : '✗';
      const statusColor = checkResult.rows.length > 0 ? colors.green : colors.red;
      console.log(`
  [${statusColor}${status}${colors.reset}] ${rec.table.padEnd(15)} | ${rec.index.padEnd(25)} | ${rec.reason}`);
    }

    // 5. Connection Statistics
    log(colors.blue, '\n5. CONNECTION STATISTICS:');
    log(colors.blue, '─────────────────────────────────────────────────────');

    const connections = await client.query(`
      SELECT 
        count(*) as total_connections,
        count(*) FILTER (WHERE state = 'active') as active,
        count(*) FILTER (WHERE state = 'idle') as idle,
        count(*) FILTER (WHERE state = 'idle in transaction') as idle_in_tx
      FROM pg_stat_activity;
    `);

    const conn = connections.rows[0];
    console.log(`
  Total: ${conn.total_connections} | Active: ${conn.active} | Idle: ${conn.idle} | Idle in TX: ${conn.idle_in_tx}`);

    // 6. Long-Running Queries
    log(colors.blue, '\n6. LONG-RUNNING QUERIES (> 1 second):');
    log(colors.blue, '─────────────────────────────────────────────────────');

    const longQueries = await client.query(`
      SELECT 
        query,
        now() - query_start as duration,
        state
      FROM pg_stat_activity
      WHERE query_start < now() - interval '1 second'
        AND query NOT LIKE '%pg_stat%'
      ORDER BY query_start ASC;
    `);

    if (longQueries.rows.length === 0) {
      console.log('\n  ✓ No long-running queries!');
    } else {
      for (const row of longQueries.rows) {
        console.log(`
  [${row.state}] ${row.duration} - ${row.query.substring(0, 60)}...`);
      }
    }

    // 7. Cache Hit Ratio
    log(colors.blue, '\n7. CACHE HIT RATIO:');
    log(colors.blue, '─────────────────────────────────────────────────────');

    const cacheRatio = await client.query(`
      SELECT 
        sum(heap_blks_read) as heap_read,
        sum(heap_blks_hit) as heap_hit,
        sum(idx_blks_read) as idx_read,
        sum(idx_blks_hit) as idx_hit,
        ROUND(
          (sum(heap_blks_hit) + sum(idx_blks_hit)) * 100.0 /
          (sum(heap_blks_hit) + sum(idx_blks_hit) + sum(heap_blks_read) + sum(idx_blks_read)), 2
        ) as cache_hit_ratio
      FROM pg_statio_user_tables;
    `);

    const cache = cacheRatio.rows[0];
    const ratio = cache.cache_hit_ratio || 0;
    const ratioColor = ratio > 99 ? colors.green : ratio > 95 ? colors.yellow : colors.red;

    console.log(`
  Heap Read: ${cache.heap_read} | Heap Hit: ${cache.heap_hit}
  Index Read: ${cache.idx_read} | Index Hit: ${cache.idx_hit}
  Cache Hit Ratio: ${ratioColor}${ratio}%${colors.reset} (Target: >99%)`);

    if (ratio < 99) {
      log(colors.yellow, '\n  Recommendation: Low cache hit ratio. Consider:');
      console.log('    - Increasing shared_buffers (PostgreSQL setting)');
      console.log('    - Implementing Redis caching layer');
      console.log('    - Optimizing queries to use indices');
    }

    // 8. Performance Recommendations Summary
    log(colors.green, '\n8. ACTION ITEMS:');
    log(colors.green, '─────────────────────────────────────────────────────');

    let actionItems = [];

    if (unusedIndices.rows.length > 0) {
      actionItems.push(`Remove ${unusedIndices.rows.length} unused indices`);
    }

    if (ratio < 99) {
      actionItems.push('Increase cache hit ratio (boost shared_buffers or add Redis)');
    }

    if (longQueries.rows.length > 0) {
      actionItems.push(`Optimize ${longQueries.rows.length} long-running queries`);
    }

    if (actionItems.length === 0) {
      console.log('\n  ✓ Database is well-optimized! No immediate action required.');
    } else {
      actionItems.forEach((item, i) => {
        console.log(`\n  ${i + 1}. ${item}`);
      });
    }

    log(colors.green, '\n═══════════════════════════════════════════════════');
    log(colors.green, '  Analysis Complete');
    log(colors.green, '═══════════════════════════════════════════════════\n');

  } catch (error) {
    log(colors.red, 'Error:', error.message);
  } finally {
    await client.end();
  }
}

// Run analysis
analyzeQueries();
