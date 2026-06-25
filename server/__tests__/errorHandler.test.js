import { describe, it, expect, vi, afterEach } from "vitest";
import { errorHandler } from "../middleware/errorHandler.js";

const makeRes = (statusCode = 200) => ({
  statusCode,
  status: vi.fn().mockReturnThis(),
  json: vi.fn(),
});

describe("errorHandler", () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it("defaults to 500 when response status is still 200", () => {
    const err = new Error("Something went wrong");
    errorHandler(err, {}, makeRes(200), vi.fn());
    const res = makeRes(200);
    errorHandler(err, {}, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Something went wrong" }),
    );
  });

  it("preserves a non-200 status code already set on the response", () => {
    const err = new Error("Not found");
    const res = makeRes(404);
    errorHandler(err, {}, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("omits stack trace in production", () => {
    process.env.NODE_ENV = "production";
    const err = new Error("Prod error");
    err.stack = "some-stack-trace";
    const res = makeRes(500);
    errorHandler(err, {}, res, vi.fn());
    const payload = res.json.mock.calls[0][0];
    expect(payload.stack).toBeNull();
  });

  it("includes stack trace in development", () => {
    process.env.NODE_ENV = "development";
    const err = new Error("Dev error");
    err.stack = "some-stack-trace";
    const res = makeRes(500);
    errorHandler(err, {}, res, vi.fn());
    const payload = res.json.mock.calls[0][0];
    expect(payload.stack).toBeTruthy();
  });
});
