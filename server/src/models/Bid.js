import mongoose from 'mongoose';
const bidSchema = new mongoose.Schema({
  auction: { type: mongoose.Schema.Types.ObjectId, ref: 'Auction', required: true, index: true },
  bidder: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  amount: { type: Number, required: true, min: 1 },
  idempotencyKey: { type: String, required: true }
}, { timestamps: true, versionKey: false });
bidSchema.index({ bidder: 1, idempotencyKey: 1 }, { unique: true });
bidSchema.index({ auction: 1, amount: -1, createdAt: 1 });
export default mongoose.model('Bid', bidSchema);
