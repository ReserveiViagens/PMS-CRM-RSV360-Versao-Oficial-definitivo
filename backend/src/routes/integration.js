const express = require("express");
const router = express.Router();
const { body, query, param, validationResult } = require("express-validator");
const { authorize } = require("../middleware/auth");
const { db } = require("../config/database");
const { asyncHandler, AppError } = require("../middleware/errorHandler");
const logger = require("../utils/logger");
const { auditLogger } = require("../utils/auditLogger");
const axios = require("axios");

// Backend-v2 URL (configure via environment or hardcode for dev)
const BACKEND_V2_URL = process.env.BACKEND_V2_URL || "http://localhost:4000";

/**
 * @swagger
 * /api/integration/health:
 *   get:
 *     tags: [Integration]
 *     summary: Check integration health and connectivity
 */
router.get(
  "/health",
  authorize(["admin", "manager"]),
  asyncHandler(async (req, res) => {
    const health = {
      backend_v1: {
        status: "ok",
        timestamp: new Date().toISOString(),
      },
      backend_v2: {
        status: "unknown",
        timestamp: null,
        error: null,
      },
    };

    // Check backend-v2 connectivity
    try {
      const response = await axios.get(`${BACKEND_V2_URL}/health`, {
        timeout: 5000,
      });
      health.backend_v2.status = response.data.status || "ok";
      health.backend_v2.timestamp = new Date().toISOString();
    } catch (err) {
      health.backend_v2.status = "error";
      health.backend_v2.error = err.message;
      logger.warn("Backend-v2 health check failed:", err.message);
    }

    res.json({
      success: true,
      data: health,
    });
  }),
);

/**
 * @swagger
 * /api/integration/sync-all:
 *   post:
 *     tags: [Integration]
 *     summary: Trigger full synchronization
 */
router.post(
  "/sync-all",
  [
    authorize(["admin"]),
    body("entities").optional().isArray(),
  ],
  asyncHandler(async (req, res) => {
    const { entities = ["customers", "campaigns", "interactions", "bookings"] } = req.body;

    const results = {};

    for (const entity of entities) {
      try {
        const customersData = await db(entity).select("*").limit(1000);

        // Send to backend-v2 via API
        const syncResponse = await axios.post(
          `${BACKEND_V2_URL}/api/crm/sync/${entity}`,
          {
            data: customersData,
            source: "backend-v1",
            timestamp: new Date().toISOString(),
          },
          {
            timeout: 30000,
          },
        );

        results[entity] = {
          status: "success",
          records_sent: customersData.length,
          backend_v2_response: syncResponse.data,
        };

        auditLogger.log(req.user.id, "SYNC", `${entity}_to_v2`, null, {
          records: customersData.length,
        });
      } catch (err) {
        results[entity] = {
          status: "error",
          error: err.message,
        };
        logger.error(`Error syncing ${entity}:`, err);
      }
    }

    res.json({
      success: true,
      data: results,
    });
  }),
);

/**
 * @swagger
 * /api/integration/compare/{entity}:
 *   get:
 *     tags: [Integration]
 *     summary: Compare data between v1 and v2
 */
router.get(
  "/compare/:entity",
  [
    authorize(["admin"]),
    param("entity").isIn(["customers", "campaigns", "interactions", "bookings"]),
  ],
  asyncHandler(async (req, res) => {
    const { entity } = req.params;

    // Get data from backend-v1
    const v1Data = await db(entity).select("*").limit(100);
    const v1Count = await db(entity).count("id as count").first();

    // Get data from backend-v2
    let v2Data = [];
    let v2Count = { count: 0 };

    try {
      const v2Response = await axios.get(`${BACKEND_V2_URL}/api/crm/${entity}`, {
        timeout: 10000,
      });

      v2Data = v2Response.data.data || [];
      v2Count.count = v2Data.length;
    } catch (err) {
      logger.warn(`Could not fetch ${entity} from backend-v2:`, err.message);
    }

    // Compare record counts
    const comparison = {
      entity,
      backend_v1: {
        total_records: v1Count.count || 0,
        sample_records: v1Data.length,
      },
      backend_v2: {
        total_records: v2Count.count || 0,
        sample_records: v2Data.length,
      },
      differences: {
        count_diff: Math.abs((v1Count.count || 0) - (v2Count.count || 0)),
        records_only_in_v1: [],
        records_only_in_v2: [],
      },
    };

    res.json({
      success: true,
      data: comparison,
    });
  }),
);

/**
 * @swagger
 * /api/integration/merge-customer:
 *   post:
 *     tags: [Integration]
 *     summary: Merge customer data from both systems
 */
router.post(
  "/merge-customer",
  [
    authorize(["admin"]),
    body("customer_id").isInt({ min: 1 }),
    body("priority").isIn(["v1", "v2", "merge"]).optional().default("merge"),
  ],
  asyncHandler(async (req, res) => {
    const { customer_id, priority = "merge" } = req.body;

    // Get customer from v1
    const v1Customer = await db("customers")
      .where({ id: customer_id })
      .first();

    if (!v1Customer) {
      throw new AppError("Customer not found in v1", 404, "CUSTOMER_NOT_FOUND");
    }

    // Try to get from v2
    let v2Customer = null;
    try {
      const v2Response = await axios.get(
        `${BACKEND_V2_URL}/api/crm/customers/${customer_id}`,
        { timeout: 5000 },
      );
      v2Customer = v2Response.data.data;
    } catch (err) {
      logger.info(`Customer not found in v2: ${customer_id}`);
    }

    // Merge data based on priority
    let mergedCustomer = { ...v1Customer };

    if (v2Customer && priority !== "v1") {
      if (priority === "v2") {
        mergedCustomer = { ...v2Customer };
      } else if (priority === "merge") {
        // Merge strategy: keep most recent data
        mergedCustomer = {
          ...v1Customer,
          ...v2Customer,
          merged_at: new Date(),
          last_sync: new Date(),
        };

        // For numeric fields, take the maximum
        if (v2Customer.total_bookings > mergedCustomer.total_bookings) {
          mergedCustomer.total_bookings = v2Customer.total_bookings;
        }
        if (v2Customer.total_spent > mergedCustomer.total_spent) {
          mergedCustomer.total_spent = v2Customer.total_spent;
        }
      }
    }

    // Update in v1
    await db("customers").where({ id: customer_id }).update(mergedCustomer);

    auditLogger.log(req.user.id, "MERGE", "customers", customer_id, {
      from_v1: v1Customer,
      from_v2: v2Customer,
      result: mergedCustomer,
    });

    res.json({
      success: true,
      data: {
        customer_id,
        merged: mergedCustomer,
      },
    });
  }),
);

/**
 * @swagger
 * /api/integration/mapping:
 *   get:
 *     tags: [Integration]
 *     summary: Get field mapping between v1 and v2
 */
router.get(
  "/mapping",
  authorize(["admin", "manager"]),
  asyncHandler(async (req, res) => {
    const fieldMapping = {
      customers: {
        v1: [
          "id",
          "name",
          "email",
          "phone",
          "document",
          "city",
          "state",
          "status",
          "total_bookings",
          "total_spent",
        ],
        v2: [
          "id",
          "name",
          "email",
          "phone",
          "document",
          "address_city",
          "address_state",
          "status",
          "total_bookings",
          "total_spent",
        ],
        mapping: {
          city: "address_city",
          state: "address_state",
        },
      },
      campaigns: {
        v1: ["id", "name", "type", "status", "content", "metrics"],
        v2: ["id", "name", "type", "status", "content", "metrics"],
        mapping: {},
      },
      interactions: {
        v1: [
          "id",
          "customer_id",
          "type",
          "direction",
          "subject",
          "content",
          "status",
        ],
        v2: [
          "id",
          "customer_id",
          "type",
          "direction",
          "subject",
          "content",
          "status",
        ],
        mapping: {},
      },
      bookings: {
        v1: ["id", "customer_id", "total_value", "status", "payment_status"],
        v2: ["id", "customer_id", "total_value", "status", "payment_status"],
        mapping: {},
      },
    };

    res.json({
      success: true,
      data: fieldMapping,
    });
  }),
);

/**
 * @swagger
 * /api/integration/sync-logs:
 *   get:
 *     tags: [Integration]
 *     summary: Get synchronization history
 */
router.get(
  "/sync-logs",
  [
    authorize(["admin", "manager"]),
    query("limit").optional().isInt({ min: 1, max: 100 }).toInt(),
  ],
  asyncHandler(async (req, res) => {
    const { limit = 50 } = req.query;

    const logs = await db("sync_logs")
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
      )
      .orderBy("created_at", "desc")
      .limit(limit);

    res.json({
      success: true,
      data: {
        total: logs.length,
        logs,
      },
    });
  }),
);

module.exports = router;
