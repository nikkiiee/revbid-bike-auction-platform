import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { connectDB } from '../src/config/db.js';
import Auction from '../src/models/Auction.js';
import User from '../src/models/User.js';
import { startAuctionLifecycle } from '../src/services/auctionLifecycle.js';

test('auction lifecycle transitions and emits events', async (t) => {
  const testUri = process.env.MONGODB_TEST_URI;

  assert.ok(
    testUri,
    'MONGODB_TEST_URI must be configured in your .env file'
  );

  const databaseName = new URL(testUri).pathname.slice(1).split('?')[0];
  const developmentUri = process.env.MONGODB_URI;
  const developmentDatabaseName = developmentUri
    ? new URL(developmentUri).pathname.slice(1).split('?')[0]
    : null;

  assert.equal(databaseName, 'revbid_test');
  assert.notEqual(testUri, developmentUri);
  assert.notEqual(databaseName, developmentDatabaseName);

  await connectDB(testUri);

  const suffix = `${process.pid}-${Date.now()}`;
  const email = `revbid-lifecycle-${suffix}@example.com`;
  let stopLifecycle;
  const auctionIds = [];
  const events = [];

  t.after(async () => {
    try {
      if (auctionIds.length) {
        await Auction.deleteMany({ _id: { $in: auctionIds } });
      }
      await User.deleteOne({ email });
    } finally {
      if (stopLifecycle) stopLifecycle();
      await mongoose.disconnect();
    }
  });

  const user = await User.create({
    name: 'Lifecycle Test User',
    email,
    passwordHash: 'not-used-for-auth',
    role: 'buyer'
  });

  const io = {
    to: (room) => ({
      emit: (event, payload) => events.push({ room, event, payload })
    })
  };

  const now = Date.now();

  const scheduledAuction = await Auction.create({
    title: 'Lifecycle Scheduled Motorcycle',
    make: 'Honda',
    model: 'CB350',
    year: 2024,
    mileageKm: 2500,
    startingPrice: 10000,
    currentPrice: 10000,
    minIncrement: 500,
    startsAt: new Date(now - 1000),
    endsAt: new Date(now + 60_000),
    status: 'scheduled',
    bidCount: 0,
    highestBidder: null,
    createdBy: user._id
  });

  const expiredAuction = await Auction.create({
    title: 'Lifecycle Expired Motorcycle',
    make: 'Yamaha',
    model: 'FZ',
    year: 2023,
    mileageKm: 5000,
    startingPrice: 20000,
    currentPrice: 20000,
    minIncrement: 500,
    startsAt: new Date(now - 120_000),
    endsAt: new Date(now - 1000),
    status: 'live',
    bidCount: 0,
    highestBidder: null,
    createdBy: user._id
  });

  auctionIds.push(scheduledAuction._id, expiredAuction._id);

  stopLifecycle = startAuctionLifecycle(io);

  // Wait for the immediate lifecycle tick to finish.
  // Poll the database with a bounded timeout rather than relying on a fixed sleep.
  const deadline = Date.now() + 8000;
  let savedScheduled;
  let savedExpired;

  while (Date.now() < deadline) {
    [savedScheduled, savedExpired] = await Promise.all([
      Auction.findById(scheduledAuction._id).lean(),
      Auction.findById(expiredAuction._id).lean()
    ]);

    if (
      savedScheduled?.status === 'live' &&
      savedExpired?.status === 'ended'
    ) {
      break;
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  assert.equal(savedScheduled.status, 'live');
  assert.equal(savedExpired.status, 'ended');

  const endedEvents = events.filter(
    (item) =>
      item.room === `auction:${expiredAuction._id}` &&
      item.event === 'auction:ended'
  );

  assert.equal(endedEvents.length, 1);
  assert.equal(
    endedEvents[0].payload.auctionId,
    String(expiredAuction._id)
  );
  assert.equal(endedEvents[0].payload.winningPrice, 20000);
  assert.equal(endedEvents[0].payload.winnerId, null);

  // Additional ticks must not emit another ended event.
  await new Promise((resolve) => setTimeout(resolve, 1200));

  assert.equal(
    events.filter(
      (item) =>
        item.room === `auction:${expiredAuction._id}` &&
        item.event === 'auction:ended'
    ).length,
    1
  );
});
