import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';

import routes from './routes';
import { errorHandler } from './middleware/error.middleware';

// Load environment variables
dotenv.config();

const app = express();
const httpServer = createServer(app);

// Socket.io setup
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
  message: { success: false, error: { code: 'RATE_LIMIT', message: 'Too many requests' } },
});

// Middleware
app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  })
);
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(limiter);

// Make io available to routes
app.set('io', io);

// API Routes
app.use('/api/v1', routes);

// Root route
app.get('/', (req, res) => {
  res.json({
    name: 'OrderMind API',
    version: '1.0.0',
    status: 'running',
    docs: '/api/v1/health',
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);

  // Join restaurant room
  socket.on('join-restaurant', (restaurantId: string) => {
    socket.join(`restaurant:${restaurantId}`);
    console.log(`📍 Socket ${socket.id} joined restaurant:${restaurantId}`);
  });

  // Join KDS room
  socket.on('join-kds', (restaurantId: string) => {
    socket.join(`kds:${restaurantId}`);
    console.log(`🍳 Socket ${socket.id} joined KDS for restaurant:${restaurantId}`);
  });

  // Leave rooms
  socket.on('leave-restaurant', (restaurantId: string) => {
    socket.leave(`restaurant:${restaurantId}`);
  });

  socket.on('leave-kds', (restaurantId: string) => {
    socket.leave(`kds:${restaurantId}`);
  });

  // Handle disconnection
  socket.on('disconnect', (reason) => {
    console.log(`🔌 Client disconnected: ${socket.id} (${reason})`);
  });
});

// Start server
const PORT = parseInt(process.env.PORT || '3001', 10);

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🍽️  OrderMind API Server                                ║
║                                                           ║
║   Port:       ${PORT}                                        ║
║   Mode:       ${process.env.NODE_ENV || 'development'}                              ║
║   API:        http://localhost:${PORT}/api/v1               ║
║   Health:     http://localhost:${PORT}/api/v1/health        ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

export { app, io };
