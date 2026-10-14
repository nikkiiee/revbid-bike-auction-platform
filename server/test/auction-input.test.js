
import test from 'node:test';
import assert from 'node:assert/strict';
import { auctionInput } from '../src/validators/auctionInput.js';

function validInput(overrides = {}) {
  const startsAt = new Date(Date.now() + 60_000);

  return {
    title: 'Honda CB350 Test',
    make: 'Honda',
    model: 'CB350',
    year: 2024,
    mileageKm: 5000,
    description: 'Test motorcycle auction',
    location: 'Vijayawada',
    startingPrice: 50000,
    minIncrement: 500,
    startsAt: startsAt.toISOString(),
    endsAt: new Date(startsAt.getTime() + 60_000).toISOString(),
    ...overrides
  };
}

test('valid auction input is accepted', () => {
  const result = auctionInput.safeParse(validInput());

  assert.equal(result.success, true);
});

test('end time before start time is rejected', () => {
  const startsAt = new Date(Date.now() + 60_000);

  const result = auctionInput.safeParse(
    validInput({
      startsAt: startsAt.toISOString(),
      endsAt: new Date(startsAt.getTime() - 1000).toISOString()
    })
  );

  assert.equal(result.success, false);
});

test('equal start and end times are rejected', () => {
  const startsAt = new Date(Date.now() + 60_000);

  const result = auctionInput.safeParse(
    validInput({
      startsAt: startsAt.toISOString(),
      endsAt: startsAt.toISOString()
    })
  );

  assert.equal(result.success, false);
});

test('negative mileage is rejected', () => {
  const result = auctionInput.safeParse(
    validInput({ mileageKm: -100 })
  );

  assert.equal(result.success, false);
});

test('zero starting price is rejected', () => {
  const result = auctionInput.safeParse(
    validInput({ startingPrice: 0 })
  );

  assert.equal(result.success, false);
});

test('invalid year is rejected', () => {
  const result = auctionInput.safeParse(
    validInput({ year: 1800 })
  );

  assert.equal(result.success, false);
});

test('minimum increment defaults to 500', () => {
  const input = validInput();
  delete input.minIncrement;

  const result = auctionInput.safeParse(input);

  assert.equal(result.success, true);

  if (result.success) {
    assert.equal(result.data.minIncrement, 500);
  }
});
