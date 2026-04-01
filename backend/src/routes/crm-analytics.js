const express = require("express");
const router = express.Router();
const { query, validationResult } = require("express-validator");
const { authorize } = require("../middleware/auth");
const { db } = require("../config/database");
const { asyncHandler, AppError } = require("../middleware/errorHandler");
const logger = require("../utils/logger");

/**
 * @swagger
 * /api/crm-analytics/dashboard:
 *   get:
 *     tags: [CRM Analytics]
 *     summary: Get CRM dashboard overview
 */
router.get(
  "/dashboard",
  authorize(["admin", "manager"]),
  asyncHandler(async (req, res) => {
    // Customer statistics
    const totalCustomers = await db("customers").count("id as count").first();
    const activeCustomers = await db("customers")
      .where({ status: "active" })
      .count("id as count")
      .first();
    const newCustomersThisMonth = await db("customers")
      .where(
        db.raw("EXTRACT(MONTH FROM created_at) = EXTRACT(MONTH FROM NOW())"),
      )
      .count("id as count")
      .first();

    // Campaign statistics
    const totalCampaigns = await db("campaigns").count("id as count").first();
    const activeCampaigns = await db("campaigns")
      .where({ status: "scheduled" })
      .count("id as count")
      .first();

    // Interaction statistics
    const totalInteractions = await db("interactions").count("id as count").first();
    const pendingInteractions = await db("interactions")
      .where({ status: "pending" })
      .count("id as count")
      .first();

    // Customer metrics
    const avgBookingsPerCustomer = await db("bookings")
      .select(
        db.raw("COUNT(DISTINCT customer_id) as total_customers"),
        db.raw("COUNT(*) as total_bookings"),
        db.raw("ROUND(COUNT(*)::NUMERIC / COUNT(DISTINCT customer_id), 2) as avg_bookings"),
      )
      .first();

    res.json({
      success: true,
      data: {
        timestamp: new Date().toISOString(),
        customers: {
          total: totalCustomers.count || 0,
          active: activeCustomers.count || 0,
          new_this_month: newCustomersThisMonth.count || 0,
        },
        campaigns: {
          total: totalCampaigns.count || 0,
          active: activeCampaigns.count || 0,
        },
        interactions: {
          total: totalInteractions.count || 0,
          pending: pendingInteractions.count || 0,
        },
        bookings: {
          avg_per_customer: parseFloat(avgBookingsPerCustomer.avg_bookings) || 0,
          total: avgBookingsPerCustomer.total_bookings || 0,
        },
      },
    });
  }),
);

/**
 * @swagger
 * /api/crm-analytics/customer-segments:
 *   get:
 *     tags: [CRM Analytics]
 *     summary: Get customer segmentation analysis
 */
router.get(
  "/customer-segments",
  authorize(["admin", "manager"]),
  asyncHandler(async (req, res) => {
    // VIP analysis
    const vipLevels = await db("customers")
      .select(
        db.raw("type, COUNT(*) as count, ROUND(AVG(total_spent)::NUMERIC, 2) as avg_spent"),
      )
      .groupBy("type")
      .orderBy("count", "desc");

    // Customer status distribution
    const byStatus = await db("customers")
      .select(
        db.raw("status, COUNT(*) as count"),
      )
      .groupBy("status");

    // High-value customers
    const highValueCustomers = await db("customers")
      .select(
        "id",
        "name",
        "email",
        "total_spent",
        "total_bookings",
        "created_at",
      )
      .where(db.raw("total_spent > (SELECT AVG(total_spent) FROM customers)"))
      .orderBy("total_spent", "desc")
      .limit(10);

    res.json({
      success: true,
      data: {
        by_type: vipLevels,
        by_status: byStatus,
        high_value_customers: highValueCustomers,
      },
    });
  }),
);

/**
 * @swagger
 * /api/crm-analytics/campaign-performance:
 *   get:
 *     tags: [CRM Analytics]
 *     summary: Get campaign performance metrics
 */
router.get(
  "/campaign-performance",
  authorize(["admin", "manager"]),
  asyncHandler(async (req, res) => {
    // Campaign by type
    const byType = await db("campaigns")
      .select(
        db.raw("type, COUNT(*) as total, COUNT(CASE WHEN status = 'sent' THEN 1 END) as sent"),
      )
      .groupBy("type");

    // Campaign status distribution
    const byStatus = await db("campaigns")
      .select(
        db.raw("status, COUNT(*) as count"),
      )
      .groupBy("status")
      .orderBy("count", "desc");

    // Recent campaigns
    const recentCampaigns = await db("campaigns")
      .select(
        "id",
        "name",
        "type",
        "status",
        "created_at",
        "sent_at",
        db.raw("json_extract_path_text(metrics, 'opened') as opens"),
        db.raw("json_extract_path_text(metrics, 'clicked') as clicks"),
      )
      .orderBy("created_at", "desc")
      .limit(20);

    res.json({
      success: true,
      data: {
        by_type: byType,
        by_status: byStatus,
        recent_campaigns: recentCampaigns,
      },
    });
  }),
);

/**
 * @swagger
 * /api/crm-analytics/interaction-patterns:
 *   get:
 *     tags: [CRM Analytics]
 *     summary: Get interaction patterns and trends
 */
router.get(
  "/interaction-patterns",
  authorize(["admin", "manager"]),
  asyncHandler(async (req, res) => {
    // Interactions by type
    const byType = await db("interactions")
      .select(
        db.raw("type, COUNT(*) as count, COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending"),
      )
      .groupBy("type")
      .orderBy("count", "desc");

    // Interactions by direction
    const byDirection = await db("interactions")
      .select(
        db.raw("direction, COUNT(*) as count"),
      )
      .groupBy("direction");

    // Average resolution time (completed interactions)
    const avgResolutionTime = await db("interactions")
      .select(
        db.raw(`
          type,
          COUNT(*) as total,
          ROUND(AVG(EXTRACT(EPOCH FROM (updated_at - created_at))/3600), 2) as avg_hours_to_resolve
        `),
      )
      .where({ status: "completed" })
      .groupBy("type");

    // Most interactive customers
    const topCustomers = await db("interactions")
      .select(
        db.raw("customer_id, COUNT(*) as interaction_count"),
      )
      .groupBy("customer_id")
      .orderBy("interaction_count", "desc")
      .limit(10)
      .then((result) =>
        db("customers")
          .select("id", "name", "email")
          .whereIn("id", result.map((r) => r.customer_id)),
      );

    res.json({
      success: true,
      data: {
        by_type: byType,
        by_direction: byDirection,
        avg_resolution_time: avgResolutionTime,
        top_customers: topCustomers,
      },
    });
  }),
);

/**
 * @swagger
 * /api/crm-analytics/customer-journey:
 *   get:
 *     tags: [CRM Analytics]
 *     summary: Get customer journey analysis
 */
router.get(
  "/customer-journey/:customerId",
  [
    authorize(["admin", "manager"]),
    query("days").optional().isInt({ min: 1, max: 365 }).toInt(),
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

    const { customerId } = req.params;
    const { days = 90 } = req.query;

    // Get customer info
    const customer = await db("customers").where({ id: customerId }).first();
    if (!customer) {
      throw new AppError("Customer not found", 404, "CUSTOMER_NOT_FOUND");
    }

    // Get customer interactions
    const interactions = await db("interactions")
      .where({ customer_id: customerId })
      .where(db.raw(`created_at > NOW() - INTERVAL '${days} days'`))
      .select(
        "id",
        "type",
        "direction",
        "status",
        "created_at",
      )
      .orderBy("created_at", "asc");

    // Get customer bookings
    const bookings = await db("bookings")
      .where({ customer_id: customerId })
      .where(db.raw(`created_at > NOW() - INTERVAL '${days} days'`))
      .select(
        "id",
        "title",
        "status",
        "total_value",
        "created_at",
      )
      .orderBy("created_at", "asc");

    // Get campaign participation
    const campaigns = await db("campaigns")
      .select(
        db.raw(`
          id, name, type, status, created_at,
          CASE WHEN content @> jsonb_build_object('customer_id', ${customerId}) THEN 1 ELSE 0 END as targeted
        `),
      )
      .orderBy("created_at", "desc")
      .limit(20);

    res.json({
      success: true,
      data: {
        customer: {
          id: customer.id,
          name: customer.name,
          email: customer.email,
          total_spent: customer.total_spent,
          total_bookings: customer.total_bookings,
          created_at: customer.created_at,
        },
        interactions_count: interactions.length,
        interactions,
        bookings_count: bookings.length,
        bookings,
        recent_campaigns: campaigns,
        period_days: days,
      },
    });
  }),
);

module.exports = router;
