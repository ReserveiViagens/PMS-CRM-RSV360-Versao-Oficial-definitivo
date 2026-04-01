const express = require("express");
const router = express.Router();
const { body, query, validationResult } = require("express-validator");
const { authorize } = require("../middleware/auth");
const { db } = require("../config/database");
const { asyncHandler, AppError } = require("../middleware/errorHandler");
const logger = require("../utils/logger");
const { auditLogger } = require("../utils/auditLogger");

/**
 * @swagger
 * /api/sync/status:
 *   get:
 *     tags: [Sync]
 *     summary: Get synchronization status and health
 */
router.get(
  "/status",
  authorize(["admin"]),
  asyncHandler(async (req, res) => {
    const syncInfo = await db("sync_logs")
      .orderBy("created_at", "desc")
      .limit(10)
      .select(
        "id",
        "entity_type",
        "sync_type",
        "records_processed",
        "records_succeeded",
        "records_failed",
        "status",
        "started_at",
        "completed_at",
        "error_message",
      );

    const lastSync = syncInfo[0];
    let lastSyncStatus = "never";
    if (lastSync) {
      if (lastSync.status === "in_progress") {
        lastSyncStatus = "in_progress";
      } else if (lastSync.status === "completed") {
        lastSyncStatus = "completed";
      } else {
        lastSyncStatus = "failed";
      }
    }

    // Table statistics
    const customerCount = await db("customers").count("id as count").first();
    const campaignCount = await db("campaigns").count("id as count").first();
    const interactionCount = await db("interactions").count("id as count").first();
    const bookingCount = await db("bookings").count("id as count").first();

    res.json({
      success: true,
      data: {
        status: lastSyncStatus,
        last_sync: lastSync || null,
        table_stats: {
          customers: customerCount.count || 0,
          campaigns: campaignCount.count || 0,
          interactions: interactionCount.count || 0,
          bookings: bookingCount.count || 0,
        },
        recent_syncs: syncInfo,
      },
    });
  }),
);

/**
 * @swagger
 * /api/sync/customers:
 *   post:
 *     tags: [Sync]
 *     summary: Synchronize customer data
 */
router.post(
  "/customers",
  [
    authorize(["admin"]),
    body("batch_size").optional().isInt({ min: 10, max: 1000 }),
    body("skip_duplicates").optional().isBoolean(),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError(
        "Validation failed",
        400,
        "VALIDATION_ERROR",
        errors.array(),
      );
    }

    const { batch_size = 100, skip_duplicates = true } = req.body;
    const syncLogId = await createSyncLog("customers", "full");

    try {
      const customers = await db("customers").select("*");

      let succeeded = 0;
      let failed = 0;
      const errors_list = [];

      for (const customer of customers) {
        try {
          // Validate customer data
          if (!customer.email || !customer.name) {
            throw new Error("Missing required fields (email, name)");
          }

          // Check for duplicates
          if (skip_duplicates) {
            const existing = await db("customers")
              .where({ email: customer.email })
              .first();
            if (existing && existing.id !== customer.id) {
              logger.warn(`Duplicate customer email: ${customer.email}`);
              continue;
            }
          }

          // Update or insert (upsert logic)
          const existing = await db("customers")
            .where({ id: customer.id })
            .first();

          if (existing) {
            await db("customers").where({ id: customer.id }).update(customer);
          } else {
            await db("customers").insert(customer);
          }

          succeeded++;
        } catch (err) {
          failed++;
          errors_list.push({
            customer_id: customer.id,
            error: err.message,
          });
          logger.error(`Error syncing customer ${customer.id}:`, err);
        }
      }

      // Update sync log
      await db("sync_logs").where({ id: syncLogId }).update({
        records_processed: customers.length,
        records_succeeded: succeeded,
        records_failed: failed,
        status: "completed",
        completed_at: db.fn.now(),
      });

      auditLogger.log(req.user.id, "SYNC", "customers", null, {
        total: customers.length,
        succeeded,
        failed,
      });

      res.json({
        success: true,
        data: {
          total: customers.length,
          succeeded,
          failed,
          errors: errors_list.slice(0, 10), // First 10 errors
        },
      });
    } catch (err) {
      await db("sync_logs").where({ id: syncLogId }).update({
        status: "failed",
        error_message: err.message,
        completed_at: db.fn.now(),
      });

      throw err;
    }
  }),
);

/**
 * @swagger
 * /api/sync/campaigns:
 *   post:
 *     tags: [Sync]
 *     summary: Synchronize campaign data
 */
router.post(
  "/campaigns",
  authorize(["admin"]),
  asyncHandler(async (req, res) => {
    const syncLogId = await createSyncLog("campaigns", "full");

    try {
      const campaigns = await db("campaigns").select("*");

      let succeeded = 0;
      let failed = 0;
      const errors_list = [];

      for (const campaign of campaigns) {
        try {
          if (!campaign.name) {
            throw new Error("Missing required field: name");
          }

          const existing = await db("campaigns")
            .where({ id: campaign.id })
            .first();

          if (existing) {
            await db("campaigns")
              .where({ id: campaign.id })
              .update(campaign);
          } else {
            await db("campaigns").insert(campaign);
          }

          succeeded++;
        } catch (err) {
          failed++;
          errors_list.push({
            campaign_id: campaign.id,
            error: err.message,
          });
        }
      }

      await db("sync_logs").where({ id: syncLogId }).update({
        records_processed: campaigns.length,
        records_succeeded: succeeded,
        records_failed: failed,
        status: "completed",
        completed_at: db.fn.now(),
      });

      auditLogger.log(req.user.id, "SYNC", "campaigns", null, {
        total: campaigns.length,
        succeeded,
        failed,
      });

      res.json({
        success: true,
        data: {
          total: campaigns.length,
          succeeded,
          failed,
          errors: errors_list.slice(0, 10),
        },
      });
    } catch (err) {
      await db("sync_logs").where({ id: syncLogId }).update({
        status: "failed",
        error_message: err.message,
        completed_at: db.fn.now(),
      });

      throw err;
    }
  }),
);

/**
 * @swagger
 * /api/sync/interactions:
 *   post:
 *     tags: [Sync]
 *     summary: Synchronize interaction data
 */
router.post(
  "/interactions",
  authorize(["admin"]),
  asyncHandler(async (req, res) => {
    const syncLogId = await createSyncLog("interactions", "full");

    try {
      const interactions = await db("interactions").select("*");

      let succeeded = 0;
      let failed = 0;
      const errors_list = [];

      for (const interaction of interactions) {
        try {
          if (!interaction.customer_id || !interaction.type) {
            throw new Error("Missing required fields (customer_id, type)");
          }

          const existing = await db("interactions")
            .where({ id: interaction.id })
            .first();

          if (existing) {
            await db("interactions")
              .where({ id: interaction.id })
              .update(interaction);
          } else {
            await db("interactions").insert(interaction);
          }

          succeeded++;
        } catch (err) {
          failed++;
          errors_list.push({
            interaction_id: interaction.id,
            error: err.message,
          });
        }
      }

      await db("sync_logs").where({ id: syncLogId }).update({
        records_processed: interactions.length,
        records_succeeded: succeeded,
        records_failed: failed,
        status: "completed",
        completed_at: db.fn.now(),
      });

      auditLogger.log(req.user.id, "SYNC", "interactions", null, {
        total: interactions.length,
        succeeded,
        failed,
      });

      res.json({
        success: true,
        data: {
          total: interactions.length,
          succeeded,
          failed,
          errors: errors_list.slice(0, 10),
        },
      });
    } catch (err) {
      await db("sync_logs").where({ id: syncLogId }).update({
        status: "failed",
        error_message: err.message,
        completed_at: db.fn.now(),
      });

      throw err;
    }
  }),
);

/**
 * @swagger
 * /api/sync/bookings:
 *   post:
 *     tags: [Sync]
 *     summary: Synchronize booking data
 */
router.post(
  "/bookings",
  authorize(["admin"]),
  asyncHandler(async (req, res) => {
    const syncLogId = await createSyncLog("bookings", "full");

    try {
      const bookings = await db("bookings").select("*");

      let succeeded = 0;
      let failed = 0;
      const errors_list = [];

      for (const booking of bookings) {
        try {
          if (!booking.customer_id || !booking.total_value) {
            throw new Error("Missing required fields (customer_id, total_value)");
          }

          const existing = await db("bookings")
            .where({ id: booking.id })
            .first();

          if (existing) {
            await db("bookings")
              .where({ id: booking.id })
              .update(booking);
          } else {
            await db("bookings").insert(booking);
          }

          succeeded++;
        } catch (err) {
          failed++;
          errors_list.push({
            booking_id: booking.id,
            error: err.message,
          });
        }
      }

      await db("sync_logs").where({ id: syncLogId }).update({
        records_processed: bookings.length,
        records_succeeded: succeeded,
        records_failed: failed,
        status: "completed",
        completed_at: db.fn.now(),
      });

      auditLogger.log(req.user.id, "SYNC", "bookings", null, {
        total: bookings.length,
        succeeded,
        failed,
      });

      res.json({
        success: true,
        data: {
          total: bookings.length,
          succeeded,
          failed,
          errors: errors_list.slice(0, 10),
        },
      });
    } catch (err) {
      await db("sync_logs").where({ id: syncLogId }).update({
        status: "failed",
        error_message: err.message,
        completed_at: db.fn.now(),
      });

      throw err;
    }
  }),
);

/**
 * @swagger
 * /api/sync/validate:
 *   post:
 *     tags: [Sync]
 *     summary: Validate data integrity before sync
 */
router.post(
  "/validate",
  [
    authorize(["admin"]),
    body("entity_type")
      .isIn(["customers", "campaigns", "interactions", "bookings"])
      .withMessage("Invalid entity type"),
  ],
  asyncHandler(async (req, res) => {
    const { entity_type } = req.body;

    const validation = await validateData(entity_type);

    res.json({
      success: true,
      data: {
        entity_type,
        is_valid: validation.is_valid,
        total_records: validation.total_records,
        valid_records: validation.valid_records,
        invalid_records: validation.invalid_records,
        warnings: validation.warnings,
        errors: validation.errors.slice(0, 10),
      },
    });
  }),
);

/**
 * Helper: Create sync log entry
 */
async function createSyncLog(entityType, syncType) {
  const [log] = await db("sync_logs")
    .insert({
      entity_type: entityType,
      sync_type: syncType,
      status: "in_progress",
      started_at: db.fn.now(),
    })
    .returning("id");

  return log.id;
}

/**
 * Helper: Validate data
 */
async function validateData(entityType) {
  const records = await db(entityType).select("*");
  let validRecords = 0;
  let invalidRecords = 0;
  const warnings = [];
  const errors = [];

  for (const record of records) {
    const validation = validateRecord(entityType, record);
    if (validation.valid) {
      validRecords++;
    } else {
      invalidRecords++;
      errors.push({
        record_id: record.id,
        issues: validation.issues,
      });
    }
    if (validation.warnings.length > 0) {
      warnings.push({
        record_id: record.id,
        warnings: validation.warnings,
      });
    }
  }

  return {
    is_valid: invalidRecords === 0,
    total_records: records.length,
    valid_records: validRecords,
    invalid_records: invalidRecords,
    warnings,
    errors,
  };
}

/**
 * Helper: Validate single record
 */
function validateRecord(entityType, record) {
  const issues = [];
  const warnings = [];
  let valid = true;

  switch (entityType) {
    case "customers":
      if (!record.email) {
        issues.push("Missing email");
        valid = false;
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(record.email)) {
        issues.push("Invalid email format");
        valid = false;
      }
      if (!record.name) {
        issues.push("Missing name");
        valid = false;
      }
      if (record.total_spent < 0) {
        warnings.push("Negative total_spent");
      }
      break;

    case "campaigns":
      if (!record.name) {
        issues.push("Missing name");
        valid = false;
      }
      if (!record.type) {
        issues.push("Missing type");
        valid = false;
      }
      if (!["email", "sms", "push", "social"].includes(record.type)) {
        warnings.push(`Unknown campaign type: ${record.type}`);
      }
      break;

    case "interactions":
      if (!record.customer_id) {
        issues.push("Missing customer_id");
        valid = false;
      }
      if (!record.type) {
        issues.push("Missing type");
        valid = false;
      }
      if (!record.direction) {
        issues.push("Missing direction");
        valid = false;
      }
      if (!["inbound", "outbound"].includes(record.direction)) {
        warnings.push(`Invalid direction: ${record.direction}`);
      }
      break;

    case "bookings":
      if (!record.customer_id) {
        issues.push("Missing customer_id");
        valid = false;
      }
      if (!record.total_value || record.total_value < 0) {
        issues.push("Invalid total_value");
        valid = false;
      }
      break;
  }

  return { valid, issues, warnings };
}

module.exports = router;
