
import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../src/config/db.js';
import Auction from '../src/models/Auction.js';
import User from '../src/models/User.js';

const bikes = [
  {
    title: '2022 Royal Enfield Interceptor 650',
    make: 'Royal Enfield',
    model: 'Interceptor 650',
    year: 2022,
    mileageKm: 8400,
    location: 'Bengaluru, Karnataka',
    startingPrice: 180000,
    minIncrement: 1000,
    imageUrl: 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=1200&q=85',
    description: 'A beautifully maintained modern classic with service history and clean ownership.'
  },
  {
    title: '2021 Triumph Street Twin 900',
    make: 'Triumph',
    model: 'Street Twin 900',
    year: 2021,
    mileageKm: 6200,
    location: 'Pune, Maharashtra',
    startingPrice: 360000,
    minIncrement: 2000,
    imageUrl: 'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?auto=format&fit=crop&w=1200&q=85',
    description: 'Premium roadster, carefully inspected, with documented maintenance.'
  },
  {
    title: '2020 Kawasaki Ninja 650',
    make: 'Kawasaki',
    model: 'Ninja 650',
    year: 2020,
    mileageKm: 11900,
    location: 'Hyderabad, Telangana',
    startingPrice: 420000,
    minIncrement: 2500,
    imageUrl: 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=1200&q=85',
    description: 'Sport touring performance with a transparent condition report.'
  },
  {
    title: '2023 Honda CB350 RS',
    make: 'Honda',
    model: 'CB350 RS',
    year: 2023,
    mileageKm: 3100,
    location: 'Chennai, Tamil Nadu',
    startingPrice: 150000,
    minIncrement: 1000,
    imageUrl: 'https://images.unsplash.com/photo-1609630875171-b1321377ee65?auto=format&fit=crop&w=1200&q=85',
    description: 'Low-mileage scrambler-inspired motorcycle in excellent condition.'
  }
];

async function seed() {
  try {
    await connectDB();

    const creator = await User.findOne();

    if (!creator) {
      throw new Error(
        'No registered user found. Create an account in RevBid first.'
      );
    }

    const now = new Date();
    const startsAt = new Date(now.getTime() - 60_000);
    const endsAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    for (const bike of bikes) {
      const existing = await Auction.findOne({ title: bike.title });

      if (existing) {
        console.log(`Already exists: ${bike.title} (${existing._id})`);
        continue;
      }

      const auction = await Auction.create({
        ...bike,
        currentPrice: bike.startingPrice,
        startsAt,
        endsAt,
        status: 'live',
        createdBy: creator._id
      });

      console.log(`Created: ${auction.title}`);
      console.log(`MongoDB ID: ${auction._id}`);
    }

    console.log('\nAuction seeding completed.');
  } finally {
    await mongoose.disconnect();
  }
}

seed().catch(error => {
  console.error('Seeding failed:', error.message);
  process.exitCode = 1;
});
