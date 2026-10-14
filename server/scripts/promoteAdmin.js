
import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../src/config/db.js';
import User from '../src/models/User.js';

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();

  if (!email) {
    throw new Error(
      'Set ADMIN_EMAIL to the email of an already registered account.'
    );
  }

  try {
    await connectDB();

    const user = await User.findOneAndUpdate(
      { email },
      { $set: { role: 'admin' } },
      { new: true, runValidators: true }
    ).select('_id name email role');

    if (!user) {
      throw new Error(
        `No account found for ${email}. Register that account first.`
      );
    }

    console.log('Admin role assigned successfully.');
    console.log({
      name: user.name,
      email: user.email,
      role: user.role
    });
  } finally {
    await mongoose.disconnect();
  }
}

main().catch(error => {
  console.error('Admin setup failed:', error.message);
  process.exitCode = 1;
});
