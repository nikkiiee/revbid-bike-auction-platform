
import 'dotenv/config';
import http from 'node:http';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { Server } from 'socket.io';

import { createApp } from './app.js';
import User from './models/User.js';
import { connectDB } from './config/db.js';
import { logger } from './utils/logger.js';
import { startAuctionLifecycle } from './services/auctionLifecycle.js';

const server = http.createServer();
const io = new Server(server, {
  cors: {
    origin: [
      'http://localhost:5173',
      'http://localhost:5174',
      ...(process.env.CLIENT_ORIGIN
        ? [process.env.CLIENT_ORIGIN]
        : []),
    ],
    methods: ['GET', 'POST'],
  },
  transports: ['websocket', 'polling'],
});

const app = createApp({ io });
server.removeAllListeners('request');
server.on('request', (req, res) => {
  if (req.url?.startsWith('/socket.io/')) {
    return;
  }

  app(req, res);
});

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;

    if (!token) {
      return next(new Error('Authentication required'));
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET, {
      issuer: 'bike-auction-api',
      audience: 'bike-auction-client',
    });

    const user = await User.findById(payload.sub)
      .select('_id name email role disabled');

    if (!user || user.disabled) {
      return next(new Error('Account unavailable'));
    }

    socket.data.user = {
      id: String(user._id),
      role: user.role,
    };

    next();
  } catch {
    next(new Error('Invalid or expired token'));
  }
});

io.on('connection', (socket) => {
  socket.on('auction:join', (auctionId) => {
    if (
      typeof auctionId === 'string' &&
      /^[a-f\d]{24}$/i.test(auctionId)
    ) {
      socket.join(`auction:${auctionId}`);
    }
  });

  socket.on('auction:leave', (auctionId) => {
    if (
      typeof auctionId === 'string' &&
      /^[a-f\d]{24}$/i.test(auctionId)
    ) {
      socket.leave(`auction:${auctionId}`);
    }
  });
});

const port = Number(process.env.PORT || 5000);

await connectDB();

const stopLifecycle = startAuctionLifecycle(io);

server.listen(port, () => {
  logger.info({ port }, 'Bike auction API listening');
});

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    stopLifecycle();

    io.close(() => {
      mongoose.connection.close().finally(() => {
        process.exit(0);
      });
    });
  });
}
