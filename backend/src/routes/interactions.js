const express = require("express");
const router = express.Router();
const { body, query, param, validationResult } = require("express-validator");
const { authorize } = require("../middleware/auth");
const { db } = require("../config/database");
const { asyncHandler, AppError } = require("../middleware/errorHandler");
const logger = require("../utils/logger");
const { auditLogger } = require("../utils/auditLogger");

/**
 * @swagger
 * /api/interactions:
 *   get:
 *     tags: [Interactions]
 *     summary: Get all interactions
 *     security:
 *       - bearerAuth: []
 */
router.get(
  "/",
  [
    authorize(["admin", "manager", "user"]),
    query("page").optional().isInt({ min: 1 }).toInt(),
    query("limit").optional().isInt({ min: 1, max: 100 }).toInt(),
    query("customer_id").optional().isInt(),
    query("type").optional().trim(),
    query("direction").optional().isIn(["inbound", "outbound"]),
    query("status").optional().isIn(["ongoing", "completed", "pending"]),
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

    const { page = 1, limit = 10, customer_id, type, direction, status } = req.query;
    const offset = (page - 1) * limit;

    // Build query
    let query = db("interactions").select(
      "id",
      "customer_id",
      "type",
      "direction",
      "subject",
      "content",
      "status",
      "assigned_to",
      "created_at",
      "updated_at",
    );

    // Apply filters
    if (customer_id) {
      query = query.where("customer_id", customer_id);
    }

    if (type) {
      query = query.where("type", type);
    }

    if (direction) {
      query = query.where("direction", direction);
    }

    if (status) {
      query = query.where("status", status);
    }

    // Get total count
    const totalQuery = query.clone();
    const total = await totalQuery.count("* as count").first();

    // Get paginated results with customer info
    const interactions = await query
      .leftJoin("customers", "interactions.customer_id", "customers.id")
      .select(
        "interactions.id",
        "interactions.customer_id",
        "interactions.type",
        "interactions.direction",
        "interactions.subject",
        "interactions.content",
        "interactions.status",
        "interactions.assigned_to",
        "interactions.created_at",
        "interactions.updated_at",
        "customers.name as customer_name",
        "customers.email as customer_email",
      )
      .limit(limit)
      .offset(offset)
      .orderBy("interactions.created_at", "desc");

    res.json({
      success: true,
      data: {
        interactions,
        pagination: {
          total: total.count,
          count: interactions.length,
          per_page: limit,
          current_page: page,
          total_pages: Math.ceil(total.count / limit),
        },
      },
    });
  }),
);

/**
 * @swagger
 * /api/interactions/{id}:
 *   get:
 *     tags: [Interactions]
 *     summary: Get interaction by ID
 */
router.get(
  "/:id",
  [
    authorize(["admin", "manager", "user"]),
    param("id").isInt({ min: 1 }).toInt(),
  ],
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const interaction = await db("interactions")
      .leftJoin("customers", "interactions.customer_id", "customers.id")
      .select(
        "interactions.*",
        "customers.name as customer_name",
        "customers.email as customer_email",
        "customers.phone as customer_phone",
      )
      .where("interactions.id", id)
      .first();

    if (!interaction) {
      throw new AppError("Interaction not found", 404, "INTERACTION_NOT_FOUND");
    }

    res.json({
      success: true,
      data: interaction,
    });
  }),
);

/**
 * @swagger
 * /api/interactions:
 *   post:
 *     tags: [Interactions]
 *     summary: Create a new interaction
 */
router.post(
  "/",
  [
    authorize(["admin", "manager", "user"]),
    body("customer_id").isInt({ min: 1 }),
    body("type").trim().isLength({ min: 1, max: 50 }),
    body("direction").isIn(["inbound", "outbound"]),
    body("subject").optional().trim().isLength({ max: 255 }),
    body("content").optional().trim(),
    body("assigned_to").optional().trim(),
    body("status").optional().isIn(["ongoing", "completed", "pending"]),
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

    // Verify customer exists
    const customer = await db("customers").where({ id: req.body.customer_id }).first();
    if (!customer) {
      throw new AppError("Customer not found", 404, "CUSTOMER_NOT_FOUND");
    }

    const { customer_id, type, direction, subject, content, assigned_to, status } = req.body;

    const [interaction] = await db("interactions")
      .insert({
        customer_id,
        type,
        direction,
        subject,
        content,
        assigned_to,
        status: status || "ongoing",
      })
      .returning("*");

    auditLogger.log(req.user.id, "CREATE", "interactions", interaction.id, {
      customer_id: interaction.customer_id,
      type: interaction.type,
      direction: interaction.direction,
    });

    res.status(201).json({
      success: true,
      data: interaction,
    });
  }),
);

/**
 * @swagger
 * /api/interactions/{id}:
 *   put:
 *     tags: [Interactions]
 *     summary: Update an interaction
 */
router.put(
  "/:id",
  [
    authorize(["admin", "manager", "user"]),
    param("id").isInt({ min: 1 }).toInt(),
    body("type").optional().trim().isLength({ min: 1, max: 50 }),
    body("direction").optional().isIn(["inbound", "outbound"]),
    body("subject").optional().trim().isLength({ max: 255 }),
    body("content").optional().trim(),
    body("assigned_to").optional().trim(),
    body("status").optional().isIn(["ongoing", "completed", "pending"]),
  ],
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const updates = req.body;

    const [interaction] = await db("interactions")
      .where({ id })
      .update({
        ...updates,
        updated_at: db.fn.now(),
      })
      .returning("*");

    if (!interaction) {
      throw new AppError("Interaction not found", 404, "INTERACTION_NOT_FOUND");
    }

    auditLogger.log(req.user.id, "UPDATE", "interactions", interaction.id, updates);

    res.json({
      success: true,
      data: interaction,
    });
  }),
);

/**
 * @swagger
 * /api/interactions/{id}:
 *   delete:
 *     tags: [Interactions]
 *     summary: Delete an interaction
 */
router.delete(
  "/:id",
  [
    authorize(["admin"]),
    param("id").isInt({ min: 1 }).toInt(),
  ],
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const interaction = await db("interactions").where({ id }).first();

    if (!interaction) {
      throw new AppError("Interaction not found", 404, "INTERACTION_NOT_FOUND");
    }

    await db("interactions").where({ id }).del();

    auditLogger.log(req.user.id, "DELETE", "interactions", id, {
      customer_id: interaction.customer_id,
      type: interaction.type,
    });

    res.json({
      success: true,
      message: "Interaction deleted successfully",
    });
  }),
);

/**
 * @swagger
 * /api/interactions/by-customer/{customerId}:
 *   get:
 *     tags: [Interactions]
 *     summary: Get all interactions for a specific customer
 */
router.get(
  "/by-customer/:customerId",
  [
    authorize(["admin", "manager", "user"]),
    param("customerId").isInt({ min: 1 }).toInt(),
    query("limit").optional().isInt({ min: 1, max: 100 }).toInt(),
  ],
  asyncHandler(async (req, res) => {
    const { customerId } = req.params;
    const { limit = 20 } = req.query;

    // Verify customer exists
    const customer = await db("customers").where({ id: customerId }).first();
    if (!customer) {
      throw new AppError("Customer not found", 404, "CUSTOMER_NOT_FOUND");
    }

    const interactions = await db("interactions")
      .where({ customer_id: customerId })
      .select(
        "id",
        "customer_id",
        "type",
        "direction",
        "subject",
        "content",
        "status",
        "assigned_to",
        "created_at",
        "updated_at",
      )
      .orderBy("created_at", "desc")
      .limit(limit);

    res.json({
      success: true,
      data: {
        customer_id: customerId,
        customer_name: customer.name,
        interactions_count: interactions.length,
        interactions,
      },
    });
  }),
);

/**
 * @swagger
 * /api/interactions/stats/summary:
 *   get:
 *     tags: [Interactions]
 *     summary: Get interaction statistics
 */
router.get(
  "/stats/summary",
  authorize(["admin", "manager"]),
  asyncHandler(async (req, res) => {
    const stats = await db("interactions")
      .select(
        db.raw("type, COUNT(*) as count"),
      )
      .groupBy("type")
      .orderBy("count", "desc");

    const statsByStatus = await db("interactions")
      .select(
        db.raw("status, COUNT(*) as count"),
      )
      .groupBy("status")
      .orderBy("count", "desc");

    const statsByDirection = await db("interactions")
      .select(
        db.raw("direction, COUNT(*) as count"),
      )
      .groupBy("direction");

    res.json({
      success: true,
      data: {
        by_type: stats,
        by_status: statsByStatus,
        by_direction: statsByDirection,
        total_interactions: await db("interactions").count("id as count").first(),
      },
    });
  }),
);

module.exports = router;
