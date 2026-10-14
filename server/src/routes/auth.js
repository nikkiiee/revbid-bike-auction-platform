import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import User from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';
const router = Router();
const registerSchema = z.object({ name: z.string().trim().min(2).max(80), email: z.string().email().max(254), password: z.string().min(10).max(128) });
const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1).max(128) });
function tokenFor(user) { return jwt.sign({ sub: String(user._id), role: user.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '1d', issuer: 'bike-auction-api', audience: 'bike-auction-client' }); }
router.post('/register', async (req, res, next) => { try {
  const input = registerSchema.parse(req.body); const passwordHash = await bcrypt.hash(input.password, 12);
  const user = await User.create({ name: input.name, email: input.email.toLowerCase(), passwordHash });
  res.status(201).json({ token: tokenFor(user), user: { id: user.id, name: user.name, email: user.email, role: user.role } });
} catch (e) { if (e.code === 11000) return res.status(409).json({ error: 'Email already registered' }); next(e); } });
router.post('/login', async (req, res, next) => { try {
  const input = loginSchema.parse(req.body); const user = await User.findOne({ email: input.email.toLowerCase() }).select('+passwordHash');
  if (!user || user.disabled || !(await bcrypt.compare(input.password, user.passwordHash))) return res.status(401).json({ error: 'Invalid email or password' });
  res.json({ token: tokenFor(user), user: { id: user.id, name: user.name, email: user.email, role: user.role } });
} catch (e) { next(e); } });
router.get('/me', requireAuth, (req, res) => res.json({ user: { id: req.user.id, name: req.user.name, email: req.user.email, role: req.user.role } }));
export default router;
