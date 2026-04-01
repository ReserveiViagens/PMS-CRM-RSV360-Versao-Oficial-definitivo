/**
 * Test Suite: Integration API
 * Tests for data integration between v1 and v2
 */
const request = require("supertest");
const { createApp } = require("../app");
const { db } = require("../config/database");

describe("Integration API", () => {
  let app;
  let authToken;

  beforeAll(async () => {
    app = createApp();
    authToken = "Bearer mock-jwt-token";
  });

  describe("GET /api/integration/health", () => {
    it("should check integration health", async () => {
      const res = await request(app)
        .get("/api/integration/health")
        .set("Authorization", authToken);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty("backend_v1");
      expect(res.body.data).toHaveProperty("backend_v2");
      expect(res.body.data.backend_v1.status).toBe("ok");
    });

    it("should require authorization", async () => {
      const res = await request(app).get("/api/integration/health");

      expect(res.status).toBe(401);
    });
  });

  describe("POST /api/integration/sync-all", () => {
    it("should sync all entities", async () => {
      const res = await request(app)
        .post("/api/integration/sync-all")
        .set("Authorization", authToken)
        .send({
          entities: ["customers", "campaigns"],
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty("customers");
      expect(res.body.data).toHaveProperty("campaigns");
    });

    it("should use default entities if not specified", async () => {
      const res = await request(app)
        .post("/api/integration/sync-all")
        .set("Authorization", authToken)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty("customers");
      expect(res.body.data).toHaveProperty("campaigns");
      expect(res.body.data).toHaveProperty("interactions");
      expect(res.body.data).toHaveProperty("bookings");
    });
  });

  describe("GET /api/integration/compare/:entity", () => {
    it("should compare customers between v1 and v2", async () => {
      const res = await request(app)
        .get("/api/integration/compare/customers")
        .set("Authorization", authToken);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty("backend_v1");
      expect(res.body.data).toHaveProperty("backend_v2");
      expect(res.body.data).toHaveProperty("differences");
      expect(res.body.data.entity).toBe("customers");
    });

    it("should compare campaigns between v1 and v2", async () => {
      const res = await request(app)
        .get("/api/integration/compare/campaigns")
        .set("Authorization", authToken);

      expect(res.status).toBe(200);
      expect(res.body.data.entity).toBe("campaigns");
    });

    it("should reject invalid entity type", async () => {
      const res = await request(app)
        .get("/api/integration/compare/invalid_entity")
        .set("Authorization", authToken);

      expect(res.status).toBe(400);
    });
  });

  describe("POST /api/integration/merge-customer", () => {
    it("should merge customer data with v1 priority", async () => {
      const res = await request(app)
        .post("/api/integration/merge-customer")
        .set("Authorization", authToken)
        .send({
          customer_id: 1,
          priority: "v1",
        });

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty("customer_id");
      expect(res.body.data).toHaveProperty("merged");
    });

    it("should merge customer data with v2 priority", async () => {
      const res = await request(app)
        .post("/api/integration/merge-customer")
        .set("Authorization", authToken)
        .send({
          customer_id: 1,
          priority: "v2",
        });

      expect(res.status).toBe(200);
    });

    it("should merge customer data with merge priority (default)", async () => {
      const res = await request(app)
        .post("/api/integration/merge-customer")
        .set("Authorization", authToken)
        .send({
          customer_id: 1,
          priority: "merge",
        });

      expect(res.status).toBe(200);
      // Merge strategy should have taken most recent data
      expect(res.body.data.merged).toHaveProperty("merged_at");
    });

    it("should use merge as default priority", async () => {
      const res = await request(app)
        .post("/api/integration/merge-customer")
        .set("Authorization", authToken)
        .send({
          customer_id: 1,
        });

      expect(res.status).toBe(200);
    });

    it("should validate customer exists in v1", async () => {
      const res = await request(app)
        .post("/api/integration/merge-customer")
        .set("Authorization", authToken)
        .send({
          customer_id: 999999,
        });

      expect(res.status).toBe(404);
    });

    it("should require valid customer_id", async () => {
      const res = await request(app)
        .post("/api/integration/merge-customer")
        .set("Authorization", authToken)
        .send({
          // missing customer_id
        });

      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/integration/mapping", () => {
    it("should get field mapping", async () => {
      const res = await request(app)
        .get("/api/integration/mapping")
        .set("Authorization", authToken);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty("customers");
      expect(res.body.data).toHaveProperty("campaigns");
      expect(res.body.data).toHaveProperty("interactions");
      expect(res.body.data).toHaveProperty("bookings");
    });

    it("should have correct customer field mapping", async () => {
      const res = await request(app)
        .get("/api/integration/mapping")
        .set("Authorization", authToken);

      const mapping = res.body.data.customers;
      expect(mapping.mapping).toHaveProperty("city");
      expect(mapping.mapping.city).toBe("address_city");
      expect(mapping.mapping.state).toBe("address_state");
    });
  });

  describe("GET /api/integration/sync-logs", () => {
    it("should get sync logs", async () => {
      const res = await request(app)
        .get("/api/integration/sync-logs")
        .set("Authorization", authToken);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty("total");
      expect(Array.isArray(res.body.data.logs)).toBe(true);
    });

    it("should respect limit parameter", async () => {
      const res = await request(app)
        .get("/api/integration/sync-logs?limit=5")
        .set("Authorization", authToken);

      expect(res.status).toBe(200);
      expect(res.body.data.logs.length).toBeLessThanOrEqual(5);
    });

    it("should validate limit parameter", async () => {
      const res = await request(app)
        .get("/api/integration/sync-logs?limit=500")
        .set("Authorization", authToken);

      expect(res.status).toBe(400);
    });
  });
});
