
import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../src/config/db.js';
import Auction from '../src/models/Auction.js';
import User from '../src/models/User.js';

async function main() {
  try {
    await connectDB();

    const creator = await User.findOne();
    if (!creator) throw new Error('Register a user first.');

    const now = new Date();

    const auction = await Auction.create({
      title: 'Expiry Test Motorcycle',
      make: 'Test',
      model: 'Lifecycle 100',
      year: 2022,
      mileageKm: 1000,
      description: 'Temporary development test auction.',
      imageUrl: '',
      location: 'Test Location',
      startingPrice: 10000,
      currentPrice: 10000,
      minIncrement: 500,
      startsAt: new Date(now.getTime() - 60_000),
      endsAt: new Date(now.getTime() + 2 * 60_000),
      status: 'live',
      createdBy: creator._id
    });

    console.log('Test auction created.');
    console.log('ID:', auction._id.toString());
    console.log('Ends at:', auction.endsAt.toLocaleString());
  } finally {
    await mongoose.disconnect();
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
