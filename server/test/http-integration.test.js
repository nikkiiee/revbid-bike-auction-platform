import 'dotenv/config';

import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

import Bid from '../src/models/Bid.js';
import { createApp } from '../src/app.js';
import { connectDB } from '../src/config/db.js';
import User from '../src/models/User.js';
import Auction from '../src/models/Auction.js';

test('HTTP integration tests', async (t) => {
  const testUri = process.env.MONGODB_TEST_URI;
  const developmentUri = process.env.MONGODB_URI;

  assert.ok(
    testUri,
    'MONGODB_TEST_URI must be configured in your .env file'
  );

  const testDatabaseName = new URL(testUri).pathname
    .slice(1)
    .split('?')[0];

  const developmentDatabaseName = developmentUri
    ? new URL(developmentUri).pathname.slice(1).split('?')[0]
    : null;

  assert.equal(
    testDatabaseName,
    'revbid_test',
    'Integration tests must use the revbid_test database'
  );

  assert.notEqual(
    testUri,
    developmentUri,
    'Test database URI must differ from the development database URI'
  );

  assert.notEqual(
    testDatabaseName,
    developmentDatabaseName,
    'Test database must differ from the development database'
  );

  await connectDB(testUri);

  // Mock Socket.IO to capture emitted events during tests.
  const emittedEvents = [];

  const app = createApp({
    io: {
      to: (room) => ({
        emit: (event, payload) => {
          emittedEvents.push({ room, event, payload });
        }
      })
    }
  });

  const server = http.createServer(app);

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const testAuctionIds = [];
  const testUserEmails = [];

  // Clean up temporary test data after all tests finish.
  t.after(async () => {
    try {
      if (testAuctionIds.length > 0) {
        await Bid.deleteMany({
          auction: { $in: testAuctionIds }
        });

        await Auction.deleteMany({
          _id: { $in: testAuctionIds }
        });
      }

      if (testUserEmails.length > 0) {
        await User.deleteMany({
          email: { $in: testUserEmails }
        });
      }
    } finally {
      await new Promise((resolve, reject) => {
        if (!server.listening) {
          resolve();
          return;
        }

        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      });

      await mongoose.disconnect();
    }
  });

  // 1. Health endpoint returns HTTP 200.
  await t.test('health endpoint returns 200', async () => {
    const response = await fetch(`${baseUrl}/health/live`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.status, 'ok');
    assert.equal(typeof body.uptime, 'number');
  });

  // 2. Invalid auction ID is rejected.
  await t.test('invalid auction ID returns 400', async () => {
    const response = await fetch(
      `${baseUrl}/api/auctions/invalid-id`
    );

    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(body.error, 'Invalid auction id');
  });

  // 3. Auction creation requires authentication.
  await t.test(
    'unauthenticated auction creation returns 401',
    async () => {
      const response = await fetch(`${baseUrl}/api/auctions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      });

      assert.equal(response.status, 401);
    }
  );

  // 4. Malformed JSON is rejected.
  await t.test('malformed JSON returns 400', async () => {
    const response = await fetch(`${baseUrl}/api/auctions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: '{"name":'
    });

    assert.equal(response.status, 400);
  });

  // 5. Invalid login input is rejected.
  await t.test('invalid login input returns 400', async () => {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'not-an-email',
        password: 'SomePassword123!'
      })
    });

    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(body.error, 'Validation failed');
  });

  // 6. Weak registration password is rejected.
  await t.test(
    'short registration password returns 400',
    async () => {
      const email =
        `weak-password-${process.pid}-${Date.now()}@example.com`;

      const response = await fetch(
        `${baseUrl}/api/auth/register`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: 'Test Buyer',
            email,
            password: '123'
          })
        }
      );

      const body = await response.json();

      assert.equal(response.status, 400);
      assert.equal(body.error, 'Validation failed');
    }
  );

  // 7. A buyer cannot create an auction.
  await t.test('buyer cannot create an auction', async () => {
    const buyerEmail =
      `revbid-buyer-${process.pid}-${Date.now()}@example.com`;

    testUserEmails.push(buyerEmail);

    const registerResponse = await fetch(
      `${baseUrl}/api/auth/register`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: 'RevBid Test Buyer',
          email: buyerEmail,
          password: `BuyerTest-${Date.now()}-Safe`
        })
      }
    );

    assert.equal(registerResponse.status, 201);

    const registration = await registerResponse.json();

    assert.equal(registration.user.role, 'buyer');
    assert.ok(registration.token);

    const auctionCountBefore = await Auction.countDocuments();

    const response = await fetch(`${baseUrl}/api/auctions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${registration.token}`
      },
      body: JSON.stringify({})
    });

    const body = await response.json();

    assert.equal(response.status, 403);
    assert.equal(body.error, 'Administrator access required');

    const auctionCountAfter = await Auction.countDocuments();

    assert.equal(auctionCountAfter, auctionCountBefore);
  });

  // 8. An admin receives validation errors for invalid auction input.
  await t.test(
    'admin receives 400 for invalid auction input',
    async () => {
      const adminEmail =
        `revbid-admin-invalid-${process.pid}-${Date.now()}@example.com`;

      testUserEmails.push(adminEmail);

      const password = `AdminTest-${Date.now()}-Safe`;
      const passwordHash = await bcrypt.hash(password, 10);

      await User.create({
        name: 'RevBid Test Admin',
        email: adminEmail,
        passwordHash,
        role: 'admin'
      });

      const loginResponse = await fetch(
        `${baseUrl}/api/auth/login`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            email: adminEmail,
            password
          })
        }
      );

      assert.equal(loginResponse.status, 200);

      const login = await loginResponse.json();

      assert.equal(login.user.role, 'admin');
      assert.ok(login.token);

      const response = await fetch(`${baseUrl}/api/auctions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${login.token}`
        },
        body: JSON.stringify({})
      });

      const body = await response.json();

      assert.equal(response.status, 400);
      assert.equal(body.error, 'Validation failed');
    }
  );

  // 9. An admin can successfully create a valid auction.
  await t.test('admin can create a valid auction', async () => {
    const adminEmail =
      `revbid-admin-create-${process.pid}-${Date.now()}@example.com`;

    testUserEmails.push(adminEmail);

    const password = `AdminTest-${Date.now()}-Safe`;
    const passwordHash = await bcrypt.hash(password, 10);

    await User.create({
      name: 'RevBid Test Admin',
      email: adminEmail,
      passwordHash,
      role: 'admin'
    });

    const loginResponse = await fetch(
      `${baseUrl}/api/auth/login`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: adminEmail,
          password
        })
      }
    );

    assert.equal(loginResponse.status, 200);

    const login = await loginResponse.json();

    assert.equal(login.user.role, 'admin');
    assert.ok(login.token);

    const startsAt = new Date(Date.now() + 60 * 60 * 1000);
    const endsAt = new Date(Date.now() + 2 * 60 * 60 * 1000);

    const response = await fetch(`${baseUrl}/api/auctions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${login.token}`
      },
      body: JSON.stringify({
        title: 'Integration Test Motorcycle',
        make: 'Honda',
        model: 'CB350',
        year: 2024,
        mileageKm: 2500,
        description: 'Temporary auction created by an integration test.',
        location: 'Test Location',
        startingPrice: 125000,
        minIncrement: 500,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString()
      })
    });

    const body = await response.json();

    assert.equal(response.status, 201);
    assert.ok(body.auction);
    assert.equal(body.auction.title, 'Integration Test Motorcycle');
    assert.equal(body.auction.make, 'Honda');
    assert.equal(body.auction.model, 'CB350');
    assert.equal(body.auction.startingPrice, 125000);
    assert.equal(body.auction.currentPrice, 125000);
    assert.equal(body.auction.status, 'scheduled');

    assert.ok(body.auction._id);

    testAuctionIds.push(body.auction._id);

    const savedAuction = await Auction.findById(body.auction._id);

    assert.ok(savedAuction);
    assert.equal(savedAuction.title, 'Integration Test Motorcycle');
    assert.equal(savedAuction.status, 'scheduled');
  });

  // 10. A bid below the minimum increment is rejected.
  await t.test(
    'bid below minimum increment is rejected without changing auction state',
    async () => {
      const buyerEmail =
        `revbid-bid-increment-${process.pid}-${Date.now()}@example.com`;

      testUserEmails.push(buyerEmail);

      const registerResponse = await fetch(
        `${baseUrl}/api/auth/register`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: 'Bid Test Buyer',
            email: buyerEmail,
            password: `BuyerTest-${Date.now()}-Safe`
          })
        }
      );

      assert.equal(registerResponse.status, 201);

      const registration = await registerResponse.json();
      const buyer = await User.findOne({ email: buyerEmail });

      assert.ok(registration.token);
      assert.ok(buyer);

      const now = new Date();

      const auction = await Auction.create({
        title: 'Minimum Increment Test Motorcycle',
        make: 'Honda',
        model: 'CB350',
        year: 2024,
        mileageKm: 2500,
        startingPrice: 10000,
        currentPrice: 10000,
        minIncrement: 500,
        startsAt: new Date(now.getTime() - 60_000),
        endsAt: new Date(now.getTime() + 60 * 60_000),
        status: 'live',
        bidCount: 0,
        highestBidder: null,
        createdBy: buyer._id
      });

      testAuctionIds.push(auction._id);

      const response = await fetch(
        `${baseUrl}/api/auctions/${auction._id}/bids`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${registration.token}`
          },
          body: JSON.stringify({
            amount: 10499,
            idempotencyKey: `increment-${Date.now()}`
          })
        }
      );

      const body = await response.json();

      assert.equal(response.status, 409);
      assert.match(body.error, /Bid must exceed current price/i);

      const savedAuction = await Auction.findById(auction._id);

      assert.ok(savedAuction);
      assert.equal(savedAuction.currentPrice, 10000);
      assert.equal(savedAuction.bidCount, 0);
      assert.equal(savedAuction.highestBidder, null);

      assert.equal(
        await Bid.countDocuments({ auction: auction._id }),
        0
      );
    }
  );

  // 11. Bidding on an expired auction is rejected.
  await t.test(
    'bid on an expired auction is rejected without changing auction state',
    async () => {
      const buyerEmail =
        `revbid-expired-bid-${process.pid}-${Date.now()}@example.com`;

      testUserEmails.push(buyerEmail);

      const registerResponse = await fetch(
        `${baseUrl}/api/auth/register`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: 'Expired Auction Buyer',
            email: buyerEmail,
            password: `BuyerTest-${Date.now()}-Safe`
          })
        }
      );

      assert.equal(registerResponse.status, 201);

      const registration = await registerResponse.json();
      const buyer = await User.findOne({ email: buyerEmail });

      assert.ok(registration.token);
      assert.ok(buyer);

      const now = new Date();

      const auction = await Auction.create({
        title: 'Expired Auction Test Motorcycle',
        make: 'Honda',
        model: 'CB350',
        year: 2024,
        mileageKm: 2500,
        startingPrice: 10000,
        currentPrice: 10000,
        minIncrement: 500,
        startsAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
        endsAt: new Date(now.getTime() - 60 * 1000),
        status: 'ended',
        bidCount: 0,
        highestBidder: null,
        createdBy: buyer._id
      });

      testAuctionIds.push(auction._id);

      const response = await fetch(
        `${baseUrl}/api/auctions/${auction._id}/bids`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${registration.token}`
          },
          body: JSON.stringify({
            amount: 10500,
            idempotencyKey: `expired-${Date.now()}`
          })
        }
      );

      const body = await response.json();

      assert.equal(response.status, 409);
      assert.equal(body.error, 'Auction is not live');

      const savedAuction = await Auction.findById(auction._id);

      assert.ok(savedAuction);
      assert.equal(savedAuction.currentPrice, 10000);
      assert.equal(savedAuction.bidCount, 0);
      assert.equal(savedAuction.highestBidder, null);

      assert.equal(
        await Bid.countDocuments({ auction: auction._id }),
        0
      );
    }
  );

  // 12. A buyer cannot outbid themselves.
  await t.test('buyer cannot outbid themselves', async () => {
    const buyerEmail =
      `revbid-self-bid-${process.pid}-${Date.now()}@example.com`;

    testUserEmails.push(buyerEmail);

    const registerResponse = await fetch(
      `${baseUrl}/api/auth/register`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: 'Self Bid Test Buyer',
          email: buyerEmail,
          password: `BuyerTest-${Date.now()}-Safe`
        })
      }
    );

    assert.equal(registerResponse.status, 201);

    const registration = await registerResponse.json();
    const buyer = await User.findOne({ email: buyerEmail });

    assert.ok(buyer);
    assert.ok(registration.token);

    const now = new Date();

    const auction = await Auction.create({
      title: 'Self Bid Test Motorcycle',
      make: 'Honda',
      model: 'CB350',
      year: 2024,
      mileageKm: 2500,
      startingPrice: 10000,
      currentPrice: 10500,
      minIncrement: 500,
      startsAt: new Date(now.getTime() - 60_000),
      endsAt: new Date(now.getTime() + 60 * 60_000),
      status: 'live',
      bidCount: 1,
      highestBidder: buyer._id,
      createdBy: buyer._id
    });

    testAuctionIds.push(auction._id);

    const response = await fetch(
      `${baseUrl}/api/auctions/${auction._id}/bids`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${registration.token}`
        },
        body: JSON.stringify({
          amount: 11000,
          idempotencyKey: `self-bid-${Date.now()}`
        })
      }
    );

    const body = await response.json();

    assert.equal(response.status, 409);
    assert.equal(body.error, 'You cannot bid against yourself');

    const savedAuction = await Auction.findById(auction._id);

    assert.ok(savedAuction);
    assert.equal(savedAuction.currentPrice, 10500);
    assert.equal(savedAuction.bidCount, 1);
    assert.equal(
      String(savedAuction.highestBidder),
      String(buyer._id)
    );

    assert.equal(
      await Bid.countDocuments({ auction: auction._id }),
      0
    );
  });

  // 13. Duplicate bid requests are idempotent.
  await t.test(
    'duplicate bid requests are idempotent',
    async () => {
      const buyerEmail =
        `revbid-idempotency-${process.pid}-${Date.now()}@example.com`;

      testUserEmails.push(buyerEmail);

      const registerResponse = await fetch(
        `${baseUrl}/api/auth/register`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: 'Idempotency Test Buyer',
            email: buyerEmail,
            password: `BuyerTest-${Date.now()}-Safe`
          })
        }
      );

      assert.equal(registerResponse.status, 201);

      const registration = await registerResponse.json();
      const buyer = await User.findOne({ email: buyerEmail });

      assert.ok(buyer);

      const now = new Date();

      const auction = await Auction.create({
        title: 'Idempotency Test Motorcycle',
        make: 'Honda',
        model: 'CB350',
        year: 2024,
        mileageKm: 2500,
        startingPrice: 10000,
        currentPrice: 10000,
        minIncrement: 500,
        startsAt: new Date(now.getTime() - 60_000),
        endsAt: new Date(now.getTime() + 60 * 60_000),
        status: 'live',
        bidCount: 0,
        highestBidder: null,
        createdBy: buyer._id
      });

      testAuctionIds.push(auction._id);

      const idempotencyKey =
        `idempotency-${process.pid}-${Date.now()}`;

      const bidUrl =
        `${baseUrl}/api/auctions/${auction._id}/bids`;

      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${registration.token}`
      };

      const sendBid = (amount) =>
        fetch(bidUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            amount,
            idempotencyKey
          })
        });

      // First request should create a bid.
      const firstResponse = await sendBid(10500);
      const firstBody = await firstResponse.json();

      assert.equal(firstResponse.status, 201);
      assert.equal(firstBody.replay, false);
      assert.equal(firstBody.bid.amount, 10500);

      // An identical retry should return the existing bid.
      const retryResponse = await sendBid(10500);
      const retryBody = await retryResponse.json();

      assert.equal(retryResponse.status, 200);
      assert.equal(retryBody.replay, true);
      assert.equal(
        String(retryBody.bid._id),
        String(firstBody.bid._id)
      );

      assert.equal(
        await Bid.countDocuments({ auction: auction._id }),
        1
      );

      // Reusing the key with a different amount must fail.
      const mismatchResponse = await sendBid(11000);
      const mismatchBody = await mismatchResponse.json();

      assert.equal(mismatchResponse.status, 409);
      assert.equal(
        mismatchBody.error,
        'Idempotency key was already used with a different request'
      );

      const savedAuction = await Auction.findById(auction._id);

      assert.equal(savedAuction.currentPrice, 10500);
      assert.equal(savedAuction.bidCount, 1);
      assert.equal(
        String(savedAuction.highestBidder),
        String(buyer._id)
      );

      assert.equal(
        await Bid.countDocuments({ auction: auction._id }),
        1
      );

      // Retries and mismatched requests must not emit extra events.
      const bidEvents = emittedEvents.filter(
        (item) =>
          item.room === `auction:${auction._id}` &&
          item.event === 'bid:placed'
      );

      assert.equal(bidEvents.length, 1);
    }
  );

  // 14. Concurrent bids preserve auction consistency.
  await t.test(
    'concurrent bids preserve auction consistency',
    async () => {
      const suffix = `${process.pid}-${Date.now()}`;

      const buyerEmails = [
        `revbid-concurrent-a-${suffix}@example.com`,
        `revbid-concurrent-b-${suffix}@example.com`
      ];

      testUserEmails.push(...buyerEmails);

      // Register two independent buyers.
      const registrations = await Promise.all(
        buyerEmails.map(async (email, index) => {
          const response = await fetch(
            `${baseUrl}/api/auth/register`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                name: `Concurrent Buyer ${index + 1}`,
                email,
                password: `BuyerTest-${Date.now()}-${index}-Safe`
              })
            }
          );

          assert.equal(response.status, 201);

          return response.json();
        })
      );

      const buyers = await Promise.all(
        buyerEmails.map((email) => User.findOne({ email }))
      );

      assert.ok(buyers.every(Boolean));

      // Start with a live auction priced at 10,000.
      const now = new Date();

      const auction = await Auction.create({
        title: 'Concurrent Bid Test Motorcycle',
        make: 'Honda',
        model: 'CB350',
        year: 2024,
        mileageKm: 2500,
        startingPrice: 10000,
        currentPrice: 10000,
        minIncrement: 500,
        startsAt: new Date(now.getTime() - 60_000),
        endsAt: new Date(now.getTime() + 60 * 60_000),
        status: 'live',
        bidCount: 0,
        highestBidder: null,
        createdBy: buyers[0]._id
      });

      testAuctionIds.push(auction._id);

      const amounts = [10500, 11000];

      // Send both requests concurrently with distinct idempotency keys.
      const responses = await Promise.all(
        registrations.map((registration, index) =>
          fetch(
            `${baseUrl}/api/auctions/${auction._id}/bids`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${registration.token}`
              },
              body: JSON.stringify({
                amount: amounts[index],
                idempotencyKey: `concurrent-${suffix}-${index}`
              })
            }
          )
        )
      );

      const results = await Promise.all(
        responses.map(async (response) => ({
          status: response.status,
          body: await response.json()
        }))
      );

      // Each request must either succeed or receive a conflict.
      for (const result of results) {
        assert.ok(
          result.status === 201 || result.status === 409,
          `Unexpected status ${result.status}: ${JSON.stringify(result.body)}`
        );
      }

      const successfulResults = results.filter(
        (result) => result.status === 201
      );

      assert.ok(
        successfulResults.length >= 1,
        'At least one concurrent bid should succeed'
      );

      const savedAuction = await Auction.findById(auction._id);
      const savedBids = await Bid.find({ auction: auction._id });

      assert.ok(savedAuction);

      // Final auction state must match the committed bid records.
      assert.equal(
        savedAuction.bidCount,
        successfulResults.length
      );

      assert.equal(
        savedBids.length,
        successfulResults.length
      );

      assert.ok(savedBids.length > 0);

      const highestSavedBid = savedBids.reduce(
        (highest, bid) =>
          bid.amount > highest.amount ? bid : highest
      );

      assert.equal(
        savedAuction.currentPrice,
        highestSavedBid.amount
      );

      assert.equal(
        String(savedAuction.highestBidder),
        String(highestSavedBid.bidder)
      );

      assert.ok(savedAuction.currentPrice >= 10500);

      for (const bid of savedBids) {
        assert.ok(bid.amount >= 10500);
      }

      // Every successful new bid should have emitted one event.
      const bidEvents = emittedEvents.filter(
        (item) =>
          item.room === `auction:${auction._id}` &&
          item.event === 'bid:placed'
      );

      assert.equal(
        bidEvents.length,
        successfulResults.length
      );
    }
  );

  // 15. Auction cancellation enforces admin and no-bids rules.
  await t.test(
    'auction cancellation enforces admin and no-bids rules',
    async () => {
      const suffix = `${process.pid}-${Date.now()}`;
      const adminEmail = `revbid-cancel-admin-${suffix}@example.com`;
      const buyerEmail = `revbid-cancel-buyer-${suffix}@example.com`;

      testUserEmails.push(adminEmail, buyerEmail);

      // Create a test administrator.
      const adminPassword = `AdminTest-${Date.now()}-Safe`;

      await User.create({
        name: 'Cancellation Test Admin',
        email: adminEmail,
        passwordHash: await bcrypt.hash(adminPassword, 10),
        role: 'admin'
      });

      const adminLoginResponse = await fetch(
        `${baseUrl}/api/auth/login`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            email: adminEmail,
            password: adminPassword
          })
        }
      );

      assert.equal(adminLoginResponse.status, 200);

      const adminLogin = await adminLoginResponse.json();

      assert.ok(adminLogin.token);

      // Register a normal buyer.
      const buyerPassword = `BuyerTest-${Date.now()}-Safe`;

      const buyerRegisterResponse = await fetch(
        `${baseUrl}/api/auth/register`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: 'Cancellation Test Buyer',
            email: buyerEmail,
            password: buyerPassword
          })
        }
      );

      assert.equal(buyerRegisterResponse.status, 201);

      const buyerRegistration = await buyerRegisterResponse.json();
      const buyer = await User.findOne({ email: buyerEmail });

      assert.ok(buyer);
      assert.ok(buyerRegistration.token);

      const now = Date.now();

      // Helper to create test auctions.
      async function createTestAuction(title, bidCount = 0) {
        const auction = await Auction.create({
          title,
          make: 'Honda',
          model: 'CB350',
          year: 2024,
          mileageKm: 2500,
          startingPrice: 10000,
          currentPrice: bidCount > 0 ? 10500 : 10000,
          minIncrement: 500,
          startsAt: new Date(now - 60_000),
          endsAt: new Date(now + 60 * 60_000),
          status: 'live',
          bidCount,
          highestBidder: bidCount > 0 ? buyer._id : null,
          createdBy: buyer._id
        });

        testAuctionIds.push(auction._id);

        return auction;
      }

      // An auction without bids should be cancellable.
      const cancellableAuction = await createTestAuction(
        'Cancellation Test Motorcycle'
      );

      // An auction with a bid should not be cancellable.
      const auctionWithBids = await createTestAuction(
        'Auction With Existing Bid',
        1
      );

      // Create a real bid record to match bidCount = 1.
      await Bid.create({
        auction: auctionWithBids._id,
        bidder: buyer._id,
        amount: 10500,
        idempotencyKey: `cancel-existing-${suffix}`
      });

      const cancelUrl = (id) =>
        `${baseUrl}/api/auctions/${id}/cancel`;

      // 1. A buyer must not be allowed to cancel an auction.
      const buyerCancelResponse = await fetch(
        cancelUrl(cancellableAuction._id),
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${buyerRegistration.token}`
          }
        }
      );

      assert.equal(buyerCancelResponse.status, 403);

      const afterBuyerAttempt = await Auction.findById(
        cancellableAuction._id
      );

      assert.ok(afterBuyerAttempt);
      assert.equal(afterBuyerAttempt.status, 'live');

      // 2. An administrator can cancel an auction with no bids.
      const adminCancelResponse = await fetch(
        cancelUrl(cancellableAuction._id),
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${adminLogin.token}`
          }
        }
      );

      assert.equal(adminCancelResponse.status, 200);

      const adminCancelBody = await adminCancelResponse.json();

      assert.equal(adminCancelBody.auction.status, 'cancelled');

      const savedCancelledAuction = await Auction.findById(
        cancellableAuction._id
      );

      assert.ok(savedCancelledAuction);
      assert.equal(savedCancelledAuction.status, 'cancelled');
      assert.equal(savedCancelledAuction.currentPrice, 10000);
      assert.equal(savedCancelledAuction.bidCount, 0);

      // 3. An auction with an existing bid cannot be cancelled.
      const bidAuctionCancelResponse = await fetch(
        cancelUrl(auctionWithBids._id),
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${adminLogin.token}`
          }
        }
      );

      assert.equal(bidAuctionCancelResponse.status, 409);

      const savedBidAuction = await Auction.findById(
        auctionWithBids._id
      );

      assert.ok(savedBidAuction);
      assert.equal(savedBidAuction.status, 'live');
      assert.equal(savedBidAuction.bidCount, 1);

      assert.equal(
        await Bid.countDocuments({
          auction: auctionWithBids._id
        }),
        1
      );

      // 4. A cancelled auction must reject new bids.
      const bidResponse = await fetch(
        `${baseUrl}/api/auctions/${cancellableAuction._id}/bids`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${buyerRegistration.token}`
          },
          body: JSON.stringify({
            amount: 10500,
            idempotencyKey: `cancelled-bid-${suffix}`
          })
        }
      );

      assert.equal(bidResponse.status, 409);

      const cancelledAuction = await Auction.findById(
        cancellableAuction._id
      );

      assert.ok(cancelledAuction);
      assert.equal(cancelledAuction.status, 'cancelled');
      assert.equal(cancelledAuction.currentPrice, 10000);
      assert.equal(cancelledAuction.bidCount, 0);

      assert.equal(
        await Bid.countDocuments({
          auction: cancellableAuction._id
        }),
        0
      );
    }
  );
});