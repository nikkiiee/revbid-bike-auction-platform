
import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import Auction from '../src/models/Auction.js';

function validAuction(overrides = {}) {
  const startsAt = new Date(Date.now() + 60_000);

  return new Auction({
    title: 'Honda CB350 Test',
    make: 'Honda',
    model: 'CB350',
    year: 2024,
    mileageKm: 5000,
    description: 'Auction validation test',
    location: 'Vijayawada',
    startingPrice: 50000,
    currentPrice: 50000,
    minIncrement: 500,
    startsAt,
    endsAt: new Date(startsAt.getTime() + 60_000),
    createdBy: new mongoose.Types.ObjectId(),
    ...overrides,
  });
}

test('valid auction passes validation', async () => {
  const auction = validAuction();

  await assert.doesNotReject(() => auction.validate());
});

test('end time before start time is rejected', async () => {
  const startsAt = new Date(Date.now() + 60_000);

  const auction = validAuction({
    startsAt,
    endsAt: new Date(startsAt.getTime() - 1),
  });

  await assert.rejects(
    () => auction.validate(),
    (error) => {
      assert.equal(error.name, 'ValidationError');
      assert.ok(error.errors.endsAt);
      return true;
    }
  );
});

test('equal start and end times are rejected', async () => {
  const startsAt = new Date(Date.now() + 60_000);

  const auction = validAuction({
    startsAt,
    endsAt: startsAt,
  });

  await assert.rejects(
    () => auction.validate(),
    (error) => {
      assert.equal(error.name, 'ValidationError');
      assert.ok(error.errors.endsAt);
      return true;
    }
  );
});

test('current price below starting price is rejected', async () => {
  const auction = validAuction({
    startingPrice: 50000,
    currentPrice: 40000,
  });

  await assert.rejects(
    () => auction.validate(),
    (error) => {
      assert.equal(error.name, 'ValidationError');
      assert.ok(error.errors.currentPrice);
      return true;
    }
  );
});
