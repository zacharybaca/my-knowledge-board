import test from 'node:test';
import assert from 'node:assert/strict';

import { getArticleById } from '../controllers/articleController.js';
import Article from '../models/Article.js';

const createResponse = () => ({
  statusCode: 200,
  payload: undefined,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.payload = body;
    return this;
  },
});

const runHandler = async (handler, req, res) => {
  let capturedError;
  await handler(req, res, (error) => {
    capturedError = error;
  });
  return capturedError;
};

const asObjectIdLike = (value) => ({
  toString: () => String(value),
});

test('getArticleById returns 404 when article is missing', async () => {
  const originalFindById = Article.findById;
  Article.findById = () => ({
    populate: async () => null,
  });

  const req = {
    params: { id: 'missing-id' },
    user: { companyId: [asObjectIdLike('company-a')] },
  };
  const res = createResponse();

  const error = await runHandler(getArticleById, req, res);

  assert.equal(res.statusCode, 404);
  assert.equal(error?.message, 'Article not found');

  Article.findById = originalFindById;
});

test('getArticleById rejects cross-company access with 403', async () => {
  const originalFindById = Article.findById;
  const article = { companyId: asObjectIdLike('company-b') };

  Article.findById = () => ({
    populate: async () => article,
  });

  const req = {
    params: { id: 'article-id' },
    user: { companyId: [asObjectIdLike('company-a')] },
  };
  const res = createResponse();

  const error = await runHandler(getArticleById, req, res);

  assert.equal(res.statusCode, 403);
  assert.equal(error?.message, 'Not authorized to view this article');

  Article.findById = originalFindById;
});

test('getArticleById returns article when company access is valid', async () => {
  const originalFindById = Article.findById;
  const article = {
    _id: 'article-id',
    companyId: asObjectIdLike('company-a'),
  };

  Article.findById = () => ({
    populate: async () => article,
  });

  const req = {
    params: { id: 'article-id' },
    user: { companyId: [asObjectIdLike('company-a')] },
  };
  const res = createResponse();

  const error = await runHandler(getArticleById, req, res);

  assert.equal(error, undefined);
  assert.equal(res.statusCode, 200);
  assert.equal(res.payload, article);

  Article.findById = originalFindById;
});
