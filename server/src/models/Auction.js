
import mongoose from 'mongoose';

const auctionSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    make: {
      type: String,
      required: true,
      trim: true,
    },
    model: {
      type: String,
      required: true,
      trim: true,
    },
    year: {
      type: Number,
      required: true,
      min: 1950,
      max: 2100,
    },
    mileageKm: {
      type: Number,
      required: true,
      min: 0,
    },
    description: {
      type: String,
      default: '',
      maxlength: 5000,
    },
    imageUrl: {
      type: String,
      default: '',
    },
    location: {
      type: String,
      default: '',
    },
    startingPrice: {
      type: Number,
      required: true,
      min: 1,
    },
    currentPrice: {
      type: Number,
      required: true,
      min: 1,
    },
    minIncrement: {
      type: Number,
      default: 500,
      min: 1,
    },
    startsAt: {
      type: Date,
      required: true,
    },
    endsAt: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ['scheduled', 'live', 'ended', 'cancelled'],
      default: 'scheduled',
      index: true,
    },
    bidCount: {
      type: Number,
      default: 0,
    },
    highestBidder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Validate auction dates and initial price.
auctionSchema.pre('validate', function () {
  if (
    this.startsAt &&
    this.endsAt &&
    this.endsAt <= this.startsAt
  ) {
    this.invalidate(
      'endsAt',
      'Auction end time must be after its start time'
    );
  }

  if (
    this.currentPrice != null &&
    this.startingPrice != null &&
    this.currentPrice < this.startingPrice
  ) {
    this.invalidate(
      'currentPrice',
      'Current price cannot be below the starting price'
    );
  }
});

// Index for auction lifecycle queries.
auctionSchema.index({ status: 1, endsAt: 1 });

export default mongoose.model('Auction', auctionSchema);
