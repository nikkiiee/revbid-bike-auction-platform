import mongoose from 'mongoose';
const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['buyer', 'admin'], default: 'buyer' },
  disabled: { type: Boolean, default: false }
}, { timestamps: true, versionKey: false });
export default mongoose.model('User', userSchema);
