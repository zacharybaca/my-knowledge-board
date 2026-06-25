import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { errorHandler } from "../../middleware/errorHandler.js";

const makeRes = (statusCode = 200) => {
  const res = { statusCode };
  res.status = vi.fn((code) => {
    res.statusCode = code;
    return res;
  });
  res.json = vi.fn();
  return res;
};

describe("errorHandler middleware", () => {
  const req = {};
  const next = vi.fn();
  let originalEnv;

  beforeEach(() => {
    originalEnv = process.env.NODE_ENV;
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it("upgrades a 200 status to 500 when an error is thrown inside a handler", () => {
    const res = makeRes(200);
    const err = new Error("Unhandled crash");

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Unhandled crash" }),
    );
  });

  it("preserves an already-set non-200 status code", () => {
    const res = makeRes(404);
    const err = new Error("Not found");

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("includes stack trace in development mode", () => {
    process.env.NODE_ENV = "development";
    const res = makeRes(500);
    const err = new Error("dev error");

    errorHandler(err, req, res, next);

    const payload = res.json.mock.calls[0][0];
    expect(payload.stack).toBeTruthy();
  });

  it("suppresses stack trace in production mode", () => {
    process.env.NODE_ENV = "production";
    const res = makeRes(500);
    const err = new Error("prod error");

    errorHandler(err, req, res, next);

    const payload = res.json.mock.calls[0][0];
    expect(payload.stack).toBeNull();
  });
});
