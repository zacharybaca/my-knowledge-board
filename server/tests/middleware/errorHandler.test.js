import { describe, it, expect } from "vitest";
import { errorHandler } from "../../middleware/errorHandler.js";

function makeRes(statusCode) {
  const res = {
    statusCode,
    _code: statusCode,
    _body: null,
    status(code) {
      this._code = code;
      return this;
    },
    json(body) {
      this._body = body;
    },
  };
  return res;
}

describe("errorHandler middleware", () => {
  it("defaults to 500 when res.statusCode is 200", () => {
    const err = new Error("Something broke");
    const res = makeRes(200);

    errorHandler(err, {}, res, () => {});

    expect(res._code).toBe(500);
    expect(res._body.message).toBe("Something broke");
  });

  it("preserves a pre-set 4xx status code", () => {
    const err = new Error("Not found");
    const res = makeRes(404);

    errorHandler(err, {}, res, () => {});

    expect(res._code).toBe(404);
    expect(res._body.message).toBe("Not found");
  });

  it("preserves a pre-set 401 status code", () => {
    const err = new Error("Unauthorized");
    const res = makeRes(401);

    errorHandler(err, {}, res, () => {});

    expect(res._code).toBe(401);
  });

  it("omits stack trace in production", () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";

    const err = new Error("Prod error");
    const res = makeRes(500);

    errorHandler(err, {}, res, () => {});

    expect(res._body.stack).toBeNull();

    process.env.NODE_ENV = originalEnv;
  });

  it("includes stack trace outside of production", () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";

    const err = new Error("Dev error");
    const res = makeRes(500);

    errorHandler(err, {}, res, () => {});

    expect(res._body.stack).toBeTruthy();

    process.env.NODE_ENV = originalEnv;
  });
});
