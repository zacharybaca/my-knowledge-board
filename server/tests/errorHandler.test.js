import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { errorHandler } from "../middleware/errorHandler.js";

const makeRes = (statusCode = 200) => {
  let code = statusCode;
  const res = {
    statusCode: code,
    status(c) {
      this.statusCode = c;
      return this;
    },
    _sent: null,
    json(body) {
      this._sent = body;
    },
  };
  return res;
};

describe("errorHandler middleware", () => {
  it("defaults to 500 when res.statusCode is 200", () => {
    const res = makeRes(200);
    const err = new Error("something went wrong");
    errorHandler(err, {}, res, () => {});
    assert.equal(res.statusCode, 500);
    assert.equal(res._sent.message, "something went wrong");
  });

  it("preserves a 4xx status code already set on res", () => {
    const res = makeRes(404);
    const err = new Error("not found");
    errorHandler(err, {}, res, () => {});
    assert.equal(res.statusCode, 404);
    assert.equal(res._sent.message, "not found");
  });

  it("hides the stack trace in production", () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    const res = makeRes(500);
    const err = new Error("oops");
    errorHandler(err, {}, res, () => {});
    assert.equal(res._sent.stack, null);
    process.env.NODE_ENV = prev;
  });

  it("exposes the stack trace outside production", () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";
    const res = makeRes(500);
    const err = new Error("oops");
    errorHandler(err, {}, res, () => {});
    assert.ok(res._sent.stack, "stack should be present in development");
    process.env.NODE_ENV = prev;
  });
});
