
import Auction from '../models/Auction.js';
import { logger } from '../utils/logger.js';

export function startAuctionLifecycle(io) {
  let running = false;

  const tick = async () => {
    // Prevent overlapping lifecycle ticks in this process.
    if (running) return;

    running = true;

    try {
      const now = new Date();

      // Start scheduled auctions whose start time has arrived
      // and whose end time is still in the future.
      const started = await Auction.updateMany(
        {
          status: 'scheduled',
          startsAt: { $lte: now },
          endsAt: { $gt: now },
        },
        {
          $set: { status: 'live' },
        }
      );

      // Find auctions that have reached their end time.
      const expiredAuctions = await Auction.find({
        status: { $in: ['scheduled', 'live'] },
        endsAt: { $lte: now },
      })
        .select('_id')
        .lean();

      let endedCount = 0;

      for (const auction of expiredAuctions) {
        // Atomically transition the auction only if it is
        // still eligible to end.
        const endedAuction = await Auction.findOneAndUpdate(
          {
            _id: auction._id,
            status: { $in: ['scheduled', 'live'] },
            endsAt: { $lte: now },
          },
          {
            $set: { status: 'ended' },
          },
          {
            new: true,
          }
        )
          .select('_id currentPrice highestBidder')
          .lean();

        // Another worker may already have ended this auction.
        // Notify clients only if this update succeeded.
        if (!endedAuction) continue;

        endedCount++;

        io.to(`auction:${endedAuction._id}`).emit('auction:ended', {
          auctionId: String(endedAuction._id),
          winningPrice: endedAuction.currentPrice,
          winnerId: endedAuction.highestBidder
            ? String(endedAuction.highestBidder)
            : null,
        });
      }

      if (started.modifiedCount || endedCount) {
        logger.info(
          {
            started: started.modifiedCount,
            ended: endedCount,
          },
          'Auction lifecycle tick'
        );
      }
    } catch (error) {
      logger.error(
        { err: error },
        'Auction lifecycle tick failed'
      );
    } finally {
      running = false;
    }
  };

  // Run immediately, then check every second.
  tick();

  const timer = setInterval(tick, 1000);
  timer.unref?.();

  return () => clearInterval(timer);
}
