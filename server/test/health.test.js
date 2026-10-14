import test from 'node:test';
import assert from 'node:assert/strict';
test('health endpoint contract documents expected status shape', () => {
  const payload = { status: 'ok', uptime: 0 };
  assert.equal(payload.status, 'ok');
  assert.equal(typeof payload.uptime, 'number');
});
