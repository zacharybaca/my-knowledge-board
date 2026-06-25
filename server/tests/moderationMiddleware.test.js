/**
 * Tests for moderationMiddleware — moderateContent.
 *
 * The middleware scans req.body fields (title, content, body, comment, text)
 * for profanity / hostile language and rejects submissions that match.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { moderateContent } from "../middleware/moderationMiddleware.js";

// moderateContent is wrapped in asyncHandler, so next() is called asynchronously.
function runModerate(body) {
  return new Promise((resolve) => {
    const res = {
      _status: null,
      status(code) {
        this._status = code;
        return this;
      },
    };
    moderateContent({ body }, res, (err) => resolve({ err, status: res._status }));
  });
}

describe("moderateContent middleware", () => {
  it("passes an empty body through without error", async () => {
    const { err } = await runModerate({});
    assert.strictEqual(err, undefined);
  });

  it("passes clean content through without error", async () => {
    const { err } = await runModerate({
      title: "Onboarding Process",
      content: "Welcome to the team. Here is how to get started.",
      comment: "Great article!",
    });
    assert.strictEqual(err, undefined);
  });

  it("rejects a submission containing a default profane word in title", async () => {
    const { err, status } = await runModerate({ title: "This contains an asshole phrase" });
    assert.ok(err instanceof Error);
    assert.match(err.message, /violates company guidelines/i);
    assert.strictEqual(status, 400);
  });

  it("rejects a submission with a custom hostile word 'loser' in body.comment", async () => {
    const { err, status } = await runModerate({ comment: "You are such a loser" });
    assert.ok(err instanceof Error);
    assert.match(err.message, /violates company guidelines/i);
    assert.strictEqual(status, 400);
  });

  it("rejects 'idiot' found in body.text", async () => {
    const { err, status } = await runModerate({ text: "Only an idiot would approve this." });
    assert.ok(err instanceof Error);
    assert.match(err.message, /violates company guidelines/i);
    assert.strictEqual(status, 400);
  });

  it("rejects 'fraud' found in body.content", async () => {
    const { err, status } = await runModerate({
      content: "This process is a complete fraud.",
    });
    assert.ok(err instanceof Error);
    assert.match(err.message, /violates company guidelines/i);
    assert.strictEqual(status, 400);
  });

  it("passes when all checked fields are undefined (body has unrelated keys)", async () => {
    const { err } = await runModerate({ someOtherField: "Hello world" });
    assert.strictEqual(err, undefined);
  });
});
