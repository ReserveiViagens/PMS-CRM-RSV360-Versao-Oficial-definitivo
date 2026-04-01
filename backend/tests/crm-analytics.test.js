/**
 * Test Suite: CRM Analytics API
 * Tests for CRM analytics and reporting endpoints
 */
const request = require("supertest");
const { createApp } = require("../app");
const { db } = require("../config/database");

describe("CRM Analytics API", () => {
  let app;
  let authToken;

  beforeAll(async () => {
    app = createApp();
    authToken = "Bearer mock-jwt-token";
  });

  describe("GET /api/crm-analytics/overview", () => {
    it("should get CRM overview metrics", async () => {
      const res = await request(app)
        .get("/api/crm-analytics/overview")
        .set("Authorization", authToken);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty("total_customers");
      expect(res.body.data).toHaveProperty("total_interactions");
      expect(res.body.data).toHaveProperty("total_campaigns");
      expect(res.body.data).toHaveProperty("active_customers");
    });

    it("should include metrics with numeric values", async () => {
      const res = await request(app)
        .get("/api/crm-analytics/overview")
        .set("Authorization", authToken);

      expect(typeof res.body.data.total_customers).toBe("number");
      expect(typeof res.body.data.total_interactions).toBe("number");
      expect(typeof res.body.data.total_campaigns).toBe("number");
      expect(typeof res.body.data.active_customers).toBe("number");
    });

    it("should require authorization", async () => {
      const res = await request(app).get("/api/crm-analytics/overview");

      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/crm-analytics/customer-segments", () => {
    it("should get customer segments", async () => {
      const res = await request(app)
        .get("/api/crm-analytics/customer-segments")
        .set("Authorization", authToken);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it("should include segment data with required fields", async () => {
      const res = await request(app)
        .get("/api/crm-analytics/customer-segments")
        .set("Authorization", authToken);

      if (res.body.data.length > 0) {
        const segment = res.body.data[0];
        expect(segment).toHaveProperty("segment_name");
        expect(segment).toHaveProperty("customer_count");
        expect(segment).toHaveProperty("average_value");
      }
    });

    it("should support segment_type filter", async () => {
      const res = await request(app)
        .get("/api/crm-analytics/customer-segments?segment_type=vip")
        .set("Authorization", authToken);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe("GET /api/crm-analytics/campaign-performance", () => {
    it("should get campaign performance metrics", async () => {
      const res = await request(app)
        .get("/api/crm-analytics/campaign-performance")
        .set("Authorization", authToken);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty("total_campaigns");
      expect(res.body.data).toHaveProperty("active_campaigns");
      expect(res.body.data).toHaveProperty("average_response_rate");
      expect(res.body.data).toHaveProperty("average_conversion_rate");
    });

    it("should include numeric performance metrics", async () => {
      const res = await request(app)
        .get("/api/crm-analytics/campaign-performance")
        .set("Authorization", authToken);

      expect(typeof res.body.data.average_response_rate).toBe("number");
      expect(typeof res.body.data.average_conversion_rate).toBe("number");
      expect(res.body.data.average_response_rate).toBeGreaterThanOrEqual(0);
      expect(res.body.data.average_response_rate).toBeLessThanOrEqual(100);
    });

    it("should support date range filtering", async () => {
      const startDate = "2024-01-01";
      const endDate = "2024-12-31";

      const res = await request(app)
        .get(
          `/api/crm-analytics/campaign-performance?start_date=${startDate}&end_date=${endDate}`
        )
        .set("Authorization", authToken);

      expect(res.status).toBe(200);
    });
  });

  describe("GET /api/crm-analytics/interaction-trends", () => {
    it("should get interaction trends", async () => {
      const res = await request(app)
        .get("/api/crm-analytics/interaction-trends")
        .set("Authorization", authToken);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it("should include trend data with dates", async () => {
      const res = await request(app)
        .get("/api/crm-analytics/interaction-trends")
        .set("Authorization", authToken);

      if (res.body.data.length > 0) {
        const trend = res.body.data[0];
        expect(trend).toHaveProperty("date");
        expect(trend).toHaveProperty("total_interactions");
        expect(trend).toHaveProperty("by_type");
      }
    });

    it("should support grouping by day", async () => {
      const res = await request(app)
        .get("/api/crm-analytics/interaction-trends?group_by=day")
        .set("Authorization", authToken);

      expect(res.status).toBe(200);
    });

    it("should support grouping by week", async () => {
      const res = await request(app)
        .get("/api/crm-analytics/interaction-trends?group_by=week")
        .set("Authorization", authToken);

      expect(res.status).toBe(200);
    });

    it("should support grouping by month", async () => {
      const res = await request(app)
        .get("/api/crm-analytics/interaction-trends?group_by=month")
        .set("Authorization", authToken);

      expect(res.status).toBe(200);
    });
  });

  describe("GET /api/crm-analytics/revenue-insights", () => {
    it("should get revenue insights", async () => {
      const res = await request(app)
        .get("/api/crm-analytics/revenue-insights")
        .set("Authorization", authToken);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty("total_revenue");
      expect(res.body.data).toHaveProperty("average_customer_value");
      expect(res.body.data).toHaveProperty("prediction");
    });

    it("should include revenue breakdown by source", async () => {
      const res = await request(app)
        .get("/api/crm-analytics/revenue-insights")
        .set("Authorization", authToken);

      expect(res.body.data).toHaveProperty("by_source");
      expect(res.body.data.by_source).toHaveProperty("campaigns");
      expect(res.body.data.by_source).toHaveProperty("direct");
    });

    it("should support currency conversion", async () => {
      const res = await request(app)
        .get("/api/crm-analytics/revenue-insights?currency=EUR")
        .set("Authorization", authToken);

      expect(res.status).toBe(200);
    });

    it("should include predictive analytics", async () => {
      const res = await request(app)
        .get("/api/crm-analytics/revenue-insights")
        .set("Authorization", authToken);

      const prediction = res.body.data.prediction;
      expect(prediction).toHaveProperty("next_month");
      expect(prediction).toHaveProperty("next_quarter");
      expect(typeof prediction.next_month).toBe("number");
    });
  });

  describe("Authorization", () => {
    it("should require authorization for all endpoints", async () => {
      const endpoints = [
        "/api/crm-analytics/overview",
        "/api/crm-analytics/customer-segments",
        "/api/crm-analytics/campaign-performance",
        "/api/crm-analytics/interaction-trends",
        "/api/crm-analytics/revenue-insights",
      ];

      for (const endpoint of endpoints) {
        const res = await request(app).get(endpoint);
        expect(res.status).toBe(401);
      }
    });

    it("should reject invalid authorization tokens", async () => {
      const res = await request(app)
        .get("/api/crm-analytics/overview")
        .set("Authorization", "Bearer invalid-token");

      expect(res.status).toBe(401);
    });
  });

  describe("Error Handling", () => {
    it("should handle invalid date ranges gracefully", async () => {
      const res = await request(app)
        .get(
          "/api/crm-analytics/campaign-performance?start_date=2024-12-31&end_date=2024-01-01"
        )
        .set("Authorization", authToken);

      expect(res.status).toBe(400);
    });

    it("should validate date format", async () => {
      const res = await request(app)
        .get(
          "/api/crm-analytics/campaign-performance?start_date=invalid&end_date=2024-12-31"
        )
        .set("Authorization", authToken);

      expect(res.status).toBe(400);
    });
  });
});
