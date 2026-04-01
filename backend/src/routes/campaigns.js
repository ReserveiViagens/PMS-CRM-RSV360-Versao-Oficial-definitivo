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
 * /api/campaigns:
 *   get:
 *     tags: [Campaigns]
 *     summary: Get all campaigns
 *     security:
 *       - bearerAuth: []
 */
router.get(
  "/",
  [
    authorize(["admin", "manager", "user"]),
    query("page").optional().isInt({ min: 1 }).toInt(),
    query("limit").optional().isInt({ min: 1, max: 100 }).toInt(),
    query("search").optional().trim(),
    query("status").optional().isIn(["draft", "scheduled", "sent", "cancelled"]),
    query("type").optional().trim(),
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

    const { page = 1, limit = 10, search, status, type } = req.query;
    const offset = (page - 1) * limit;

    // Build query
    let query = db("campaigns").select(
      "id",
      "name",
      "description",
      "type",
      "status",
      "segment_id",
      "scheduled_at",
      "sent_at",
      "content",
      "metrics",
      "created_by",
      "created_at",
      "updated_at",
    );

    // Apply filters
    if (search) {
      query = query.where(function () {
        this.where("name", "like", `%${search}%`)
          .orWhere("description", "like", `%${search}%`);
      });
    }

    if (status) {
      query = query.where("status", status);
    }

    if (type) {
      query = query.where("type", type);
    }

    // Get total count
    const totalQuery = query.clone();
    const total = await totalQuery.count("* as count").first();

    // Get paginated results
    const campaigns = await query
      .limit(limit)
      .offset(offset)
      .orderBy("created_at", "desc");

    res.json({
      success: true,
      data: {
        campaigns,
        pagination: {
          total: total.count,
          count: campaigns.length,
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
 * /api/campaigns/{id}:
 *   get:
 *     tags: [Campaigns]
 *     summary: Get campaign by ID
 */
router.get(
  "/:id",
  [
    authorize(["admin", "manager", "user"]),
    param("id").isInt({ min: 1 }).toInt(),
  ],
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const campaign = await db("campaigns").where({ id }).first();

    if (!campaign) {
      throw new AppError("Campaign not found", 404, "CAMPAIGN_NOT_FOUND");
    }

    res.json({
      success: true,
      data: campaign,
    });
  }),
);

/**
 * @swagger
 * /api/campaigns:
 *   post:
 *     tags: [Campaigns]
 *     summary: Create a new campaign
 */
router.post(
  "/",
  [
    authorize(["admin", "manager"]),
    body("name").trim().isLength({ min: 1, max: 255 }),
    body("description").optional().trim(),
    body("type").isIn(["email", "sms", "push", "social"]),
    body("content").isObject(),
    body("segment_id").optional().isInt(),
    body("scheduled_at").optional().isISO8601(),
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

    const { name, description, type, content, segment_id, scheduled_at } = req.body;

    const [campaign] = await db("campaigns")
      .insert({
        name,
        description,
        type,
        content,
        segment_id,
        scheduled_at,
        created_by: req.user.id,
      })
      .returning("*");

    auditLogger.log(req.user.id, "CREATE", "campaigns", campaign.id, {
      name: campaign.name,
      type: campaign.type,
    });

    res.status(201).json({
      success: true,
      data: campaign,
    });
  }),
);

/**
 * @swagger
 * /api/campaigns/{id}:
 *   put:
 *     tags: [Campaigns]
 *     summary: Update a campaign
 */
router.put(
  "/:id",
  [
    authorize(["admin", "manager"]),
    param("id").isInt({ min: 1 }).toInt(),
    body("name").optional().trim().isLength({ min: 1, max: 255 }),
    body("description").optional().trim(),
    body("type").optional().isIn(["email", "sms", "push", "social"]),
    body("content").optional().isObject(),
    body("segment_id").optional().isInt(),
    body("scheduled_at").optional().isISO8601(),
    body("status").optional().isIn(["draft", "scheduled", "sent", "cancelled"]),
  ],
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const updates = req.body;

    const [campaign] = await db("campaigns")
      .where({ id })
      .update({
        ...updates,
        updated_at: db.fn.now(),
      })
      .returning("*");

    if (!campaign) {
      throw new AppError("Campaign not found", 404, "CAMPAIGN_NOT_FOUND");
    }

    auditLogger.log(req.user.id, "UPDATE", "campaigns", campaign.id, updates);

    res.json({
      success: true,
      data: campaign,
    });
  }),
);

/**
 * @swagger
 * /api/campaigns/{id}:
 *   delete:
 *     tags: [Campaigns]
 *     summary: Delete a campaign
 */
router.delete(
  "/:id",
  [
    authorize(["admin"]),
    param("id").isInt({ min: 1 }).toInt(),
  ],
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const campaign = await db("campaigns").where({ id }).first();

    if (!campaign) {
      throw new AppError("Campaign not found", 404, "CAMPAIGN_NOT_FOUND");
    }

    await db("campaigns").where({ id }).del();

    auditLogger.log(req.user.id, "DELETE", "campaigns", id, {
      name: campaign.name,
    });

    res.json({
      success: true,
      message: "Campaign deleted successfully",
    });
  }),
);

module.exports = router;