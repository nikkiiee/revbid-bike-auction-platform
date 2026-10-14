
import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';

import { auctionInput } from '../validators/auctionInput.js';
import Auction from '../models/Auction.js';
import Bid from '../models/Bid.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();

// GET /api/auctions - List auctions with pagination and search.
router.get('/', async (req, res, next) => {
  try {
    const page = Math.max(
      1,
      Number.parseInt(req.query.page || '1', 10) || 1
    );

    const limit = Math.min(
      30,
      Math.max(1, Number.parseInt(req.query.limit || '12', 10) || 12)
    );

    const filter = {};

    if (
      ['scheduled', 'live', 'ended', 'cancelled'].includes(
        req.query.status
      )
    ) {
      filter.status = req.query.status;
    }

    if (req.query.q) {
      filter.$or = ['title', 'make', 'model'].map((field) => ({
        [field]: {
          $regex: String(req.query.q).slice(0, 80),
          $options: 'i'
        }
      }));
    }

    const [items, total] = await Promise.all([
      Auction.find(filter)
        .sort({ status: 1, endsAt: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Auction.countDocuments(filter)
    ]);

    res.json({
      items,
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/auctions/:id - Get auction details and latest bids.
router.get('/:id', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        error: 'Invalid auction id'
      });
    }

    const auction = await Auction.findById(req.params.id).lean();

    if (!auction) {
      return res.status(404).json({
        error: 'Auction not found'
      });
    }

    const bids = await Bid.find({
      auction: auction._id
    })
      .sort({ createdAt: -1 })
      .limit(25)
      .populate('bidder', 'name')
      .lean();

    res.json({ auction, bids });
  } catch (error) {
    next(error);
  }
});

// POST /api/auctions - Create an auction (admin only).
router.post('/', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const input = auctionInput.parse(req.body);
    const now = new Date();

    if (input.endsAt <= input.startsAt || input.endsAt <= now) {
      return res.status(400).json({
        error: 'Auction end must be after start and in the future'
      });
    }

    const auction = await Auction.create({
      ...input,
      currentPrice: input.startingPrice,
      createdBy: req.user._id,
      status: input.startsAt <= now ? 'live' : 'scheduled'
    });

    res.status(201).json({ auction });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/auctions/:id/cancel - Cancel an auction with no bids.
router.patch(
  '/:id/cancel',
  requireAuth,
  requireAdmin,
  async (req, res, next) => {
    try {
      if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(400).json({
          error: 'Invalid auction id'
        });
      }

      const auction = await Auction.findOneAndUpdate(
        {
          _id: req.params.id,
          status: { $in: ['scheduled', 'live'] },
          bidCount: 0
        },
        {
          $set: { status: 'cancelled' }
        },
        { new: true }
      );

      if (!auction) {
        return res.status(409).json({
          error: 'Auction not found, already closed, or has bids'
        });
      }

      res.json({ auction });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/auctions/:id/bids - Place a bid safely.
router.post('/:id/bids', requireAuth, async (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({
      error: 'Invalid auction id'
    });
  }

  const session = await mongoose.startSession();
  let body;

  try {
    body = z.object({
      amount: z.coerce.number().int().positive(),
      idempotencyKey: z.string().min(8).max(100)
    }).parse(req.body);

    let result;

    await session.withTransaction(async () => {
      // Check whether this request was already processed.
      const prior = await Bid.findOne({
        bidder: req.user._id,
        idempotencyKey: body.idempotencyKey
      }).session(session);

      if (prior) {
        const sameAuction =
          String(prior.auction) === String(req.params.id);
        const sameAmount = prior.amount === body.amount;

        if (!sameAuction || !sameAmount) {
          throw Object.assign(
            new Error(
              'Idempotency key was already used with a different request'
            ),
            { status: 409 }
          );
        }

        const priorAuction = await Auction.findById(
          prior.auction
        ).session(session);

        result = {
          bid: prior,
          auction: priorAuction,
          replay: true
        };

        return;
      }

      // Atomically check the auction conditions and update the price.
      const now = new Date();

      const auction = await Auction.findOneAndUpdate(
        {
          _id: req.params.id,
          status: 'live',
          startsAt: { $lte: now },
          endsAt: { $gt: now },
          $expr: {
            $gte: [
              body.amount,
              { $add: ['$currentPrice', '$minIncrement'] }
            ]
          },
          highestBidder: { $ne: req.user._id }
        },
        {
          $set: {
            currentPrice: body.amount,
            highestBidder: req.user._id
          },
          $inc: { bidCount: 1 }
        },
        {
          new: true,
          session
        }
      );

      if (!auction) {
        const current = await Auction.findById(
          req.params.id
        ).session(session);

        if (!current) {
          throw Object.assign(
            new Error('Auction not found'),
            { status: 404 }
          );
        }

        if (
          current.highestBidder &&
          String(current.highestBidder) === String(req.user._id)
        ) {
          throw Object.assign(
            new Error('You cannot bid against yourself'),
            { status: 409 }
          );
        }

        if (
          current.status !== 'live' ||
          current.startsAt > now ||
          current.endsAt <= now
        ) {
          throw Object.assign(
            new Error('Auction is not live'),
            { status: 409 }
          );
        }

        throw Object.assign(
          new Error(
            `Bid must exceed current price by at least ${current.minIncrement}`
          ),
          { status: 409 }
        );
      }

      // Save the bid within the same transaction.
      const bid = (
        await Bid.create(
          [
            {
              auction: auction._id,
              bidder: req.user._id,
              amount: body.amount,
              idempotencyKey: body.idempotencyKey
            }
          ],
          { session }
        )
      )[0];

      result = {
        bid,
        auction,
        replay: false
      };
    });

    if (!result) {
      return res.status(409).json({
        error: 'Bid could not be processed'
      });
    }

    // Notify connected clients only for a new bid.
    if (!result.replay) {
      req.app.get('io')
        .to(`auction:${req.params.id}`)
        .emit('bid:placed', {
          auctionId: req.params.id,
          amount: result.bid.amount,
          bidder: req.user.name,
          bidCount: result.auction.bidCount,
          currentPrice: result.auction.currentPrice,
          minIncrement: result.auction.minIncrement,
          highestBidder: result.auction.highestBidder,
          at: result.bid.createdAt
        });
    }

    return res
      .status(result.replay ? 200 : 201)
      .json({
        bid: result.bid,
        auction: result.auction,
        replay: result.replay
      });
  } catch (error) {
    // Handle a retry if another concurrent request committed the bid.
    if (body?.idempotencyKey) {
      try {
        const existing = await Bid.findOne({
          bidder: req.user._id,
          idempotencyKey: body.idempotencyKey
        }).lean();

        if (existing) {
          const sameAuction =
            String(existing.auction) === String(req.params.id);
          const sameAmount = existing.amount === body.amount;

          if (!sameAuction || !sameAmount) {
            return res.status(409).json({
              error:
                'Idempotency key was already used with a different request'
            });
          }

          const priorAuction = await Auction.findById(
            existing.auction
          ).lean();

          return res.status(200).json({
            bid: existing,
            auction: priorAuction,
            replay: true
          });
        }
      } catch (lookupError) {
        return next(lookupError);
      }
    }

    return next(error);
  } finally {
    await session.endSession();
  }
});

// GET /api/auctions/:id/bids - Get the latest bids.
router.get('/:id/bids', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        error: 'Invalid auction id'
      });
    }

    const bids = await Bid.find({
      auction: req.params.id
    })
      .sort({ createdAt: -1 })
      .limit(100)
      .populate('bidder', 'name')
      .lean();

    res.json({ items: bids });
  } catch (error) {
    next(error);
  }
});

export default router;
