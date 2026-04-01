/**
 * Migration: Create sync_logs table
 * This table tracks all synchronization operations between systems
 */
exports.up = function (knex) {
  return knex.schema.createTable("sync_logs", function (table) {
    table.increments("id").primary();
    table.string("entity_type", 50).notNull(); // customers, campaigns, interactions, bookings
    table.string("sync_type", 50).notNull(); // full, incremental, validation
    table.integer("records_processed").defaultTo(0);
    table.integer("records_succeeded").defaultTo(0);
    table.integer("records_failed").defaultTo(0);
    table.string("status", 50).defaultTo("in_progress"); // in_progress, completed, failed
    table.text("error_message").nullable();
    table.timestamp("started_at").defaultTo(knex.fn.now());
    table.timestamp("completed_at").nullable();
    table.timestamp("created_at").defaultTo(knex.fn.now());

    // Indexes for common queries
    table.index("entity_type");
    table.index("status");
    table.index("created_at");
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists("sync_logs");
};
