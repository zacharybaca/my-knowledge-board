import { describe, it, expect, vi } from "vitest";
import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { errorHandler } from "../middleware/errorHandler.js";

function makeRes(statusCode = 200) {
  const res = {
    statusCode,
    _status: statusCode,
    _body: null,
    status(code) {
      this._status = code;
      this.statusCode = code;
      return this;
    },
    _body: null,
    json(body) {
      this._body = body;
    json(body) {
      this._body = body;
      return this;
    },
  };
  return res;
}

describe("errorHandler middleware", () => {
  it("normalises a 200 status to 500 when an error is thrown", () => {
    const err = new Error("Something went wrong");
    const res = makeRes(200); // Express default before status() is called
    errorHandler(err, {}, res, () => {});
    expect(res._status).toBe(500);
    expect(res._body.message).toBe("Something went wrong");
  });

  it("preserves a non-200 status code set before the error", () => {
    const err = new Error("Not found");
    const res = makeRes(404);
    errorHandler(err, {}, res, () => {});
    expect(res._status).toBe(404);
    expect(res._body.message).toBe("Not found");
  });

  it("includes stack trace in development", () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";
    const err = new Error("dev error");
    const res = makeRes(500);
    errorHandler(err, {}, res, () => {});
    expect(res._body.stack).toBeTruthy();
    process.env.NODE_ENV = originalEnv;
  });

  it("omits stack trace in production", () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    const err = new Error("prod error");
    const res = makeRes(500);
    errorHandler(err, {}, res, () => {});
    expect(res._body.stack).toBeNull();
    process.env.NODE_ENV = originalEnv;
  let originalEnv;

  beforeEach(() => {
    originalEnv = process.env.NODE_ENV;
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it("maps a 200 status code to 500 when an error occurs", () => {
    const res = makeRes(200);
    const err = new Error("Unhandled error");
    errorHandler(err, {}, res, () => {});
    assert.strictEqual(res._status, 500);
    assert.strictEqual(res._body.message, "Unhandled error");
  });

  it("preserves a non-200 status code set before the throw", () => {
    const res = makeRes(404);
    const err = new Error("Not found");
    errorHandler(err, {}, res, () => {});
    assert.strictEqual(res._status, 404);
    assert.strictEqual(res._body.message, "Not found");
  });

  it("omits the stack trace in production", () => {
    process.env.NODE_ENV = "production";
    const res = makeRes(500);
    const err = new Error("prod error");
    errorHandler(err, {}, res, () => {});
    assert.strictEqual(res._body.stack, null);
  });

  it("includes the stack trace outside of production", () => {
    process.env.NODE_ENV = "development";
    const res = makeRes(500);
    const err = new Error("dev error");
    errorHandler(err, {}, res, () => {});
    assert.ok(typeof res._body.stack === "string" && res._body.stack.length > 0);
  });
});
