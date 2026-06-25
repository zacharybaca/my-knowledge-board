import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { moderateContent } from "../middleware/moderationMiddleware.js";

// asyncHandler wraps the function; we can invoke the returned function and
// await it, checking what gets passed to next().

const makeReq = (body = {}) => ({ body });

const makeRes = () => {
  let code = null;
  return {
    status(c) {
      code = c;
      return this;
    },
    get statusCode() {
      return code;
    },
    set statusCode(c) {
      code = c;
    },
  };
};

const callModerate = async (body) => {
  const req = makeReq(body);
  const res = makeRes();
  let nextError = undefined;
  let nextCalled = false;

  // asyncHandler wraps the inner async function; calling it returns a Promise.
  // Errors thrown inside are forwarded to `next(err)`.
  await moderateContent(req, res, (err) => {
    nextCalled = true;
    nextError = err;
  });

  return { res, nextCalled, nextError };
};

describe("moderateContent middleware", () => {
  it("passes clean content through", async () => {
    const { nextCalled, nextError } = await callModerate({
      title: "How to reset your password",
      content: "Click the reset link in your email.",
    });
    assert.ok(nextCalled, "next should be called");
    assert.equal(nextError, undefined, "next should not receive an error");
  });

  it("blocks content containing a profane term", async () => {
    // Uses "idiot" (singular) — the plural is not added to the dictionary
    const { res, nextCalled, nextError } = await callModerate({
      body: "This company is run by a complete idiot",
    });
    // asyncHandler calls next(err) so next is still called, but with an error
    assert.ok(nextCalled);
    assert.ok(nextError instanceof Error, "should pass an Error to next");
    assert.match(nextError.message, /company guidelines/);
    assert.equal(res.statusCode, 400);
  });

  it("blocks profanity in article title field", async () => {
    const { nextError } = await callModerate({
      title: "You are a moron if you do this",
    });
    assert.ok(nextError instanceof Error);
  });

  it("blocks profanity in comment field", async () => {
    const { nextError } = await callModerate({
      comment: "What a fraud this whole process is",
    });
    assert.ok(nextError instanceof Error);
  });

  it("blocks profanity in text field", async () => {
    const { nextError } = await callModerate({
      text: "The manager is a total jerk",
    });
    assert.ok(nextError instanceof Error);
  });

  it("passes when all body fields are absent (empty submission)", async () => {
    const { nextCalled, nextError } = await callModerate({});
    assert.ok(nextCalled);
    assert.equal(nextError, undefined);
  });

  it("passes when fields are empty strings", async () => {
    const { nextCalled, nextError } = await callModerate({
      title: "",
      content: "",
      body: "",
    });
    assert.ok(nextCalled);
    assert.equal(nextError, undefined);
  });

  it("blocks custom-dictionary term (nazi)", async () => {
    const { nextError } = await callModerate({
      body: "Stop acting like a nazi",
    });
    assert.ok(nextError instanceof Error);
  });
});
