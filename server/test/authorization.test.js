import test from 'node:test';
import assert from 'node:assert/strict';
import { requireAdmin } from '../src/middleware/auth.js';

function runMiddleware(user) {
  let statusCode = 200;
  let responseBody;
  let nextCalled = false;

  const req = { user };

  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(body) {
      responseBody = body;
      return this;
    }
  };

  const next = () => {
    nextCalled = true;
  };

  requireAdmin(req, res, next);

  return { statusCode, responseBody, nextCalled };
}

test('buyer cannot create admin-only resources', () => {
  const result = runMiddleware({
    _id: 'buyer123',
    role: 'buyer'
  });

  assert.equal(result.statusCode, 403);
  assert.deepEqual(result.responseBody, {
    error: 'Administrator access required'
  });
  assert.equal(result.nextCalled, false);
});

test('admin is allowed through authorization middleware', () => {
  const result = runMiddleware({
    _id: 'admin123',
    role: 'admin'
  });

  assert.equal(result.statusCode, 200);
  assert.equal(result.nextCalled, true);
});

test('missing user is rejected by admin middleware', () => {
  const result = runMiddleware(undefined);

  assert.equal(result.statusCode, 403);
  assert.equal(result.nextCalled, false);
});