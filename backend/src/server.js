const express = require('express');
const http = require('http');
const socketio = require('socket.io');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const connectDB = require('./config/db');
const { errorHandler } = require('./middleware/errorMiddleware');
const Guard = require('./models/Guard');

// Load env vars
dotenv.config();

const requiredEnvVars = ['MONGO_URI', 'JWT_SECRET'];
const missingEnvVars = requiredEnvVars.filter((key) => !process.env[key]);

if (missingEnvVars.length > 0) {
  console.error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
  process.exit(1);
}

const app = express();
const server = http.createServer(app);
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
].filter(Boolean);

const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    const error = new Error('Origin is not allowed by CORS');
    error.statusCode = 403;
    return callback(error);
  },
  credentials: true,
};

const io = socketio(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Pass socket.io to app
app.set('socketio', io);

// Middleware
app.use(express.json());
app.use(cors(corsOptions));

// Static folder for uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Health check endpoint
app.get('/api/health', (req, res) => {
  const databaseConnected = mongoose.connection.readyState === 1;

  res.status(databaseConnected ? 200 : 503).json({
    success: databaseConnected,
    status: databaseConnected ? 'ok' : 'degraded',
    databaseConnected,
    timestamp: new Date()
  });
});

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/guards', require('./routes/guardRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/detections', require('./routes/alertRoutes'));
app.use('/api/deliveries', require('./routes/deliveryRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));

// Root route
app.get('/', (req, res) => {
  res.send('Lanka Beacon API is running...');
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

// Error Handler
app.use(errorHandler);

// Socket.io connection
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Socket authentication required'));

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const guard = await Guard.findById(decoded.id).select('_id');
    if (!guard) return next(new Error('Socket guard not found'));

    socket.guardId = guard._id.toString();
    return next();
  } catch {
    return next(new Error('Socket authentication failed'));
  }
});

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);
  socket.join([socket.guardId, `guard:${socket.guardId}`]);

  socket.on('join', (guardId) => {
    if (guardId && String(guardId) === socket.guardId) {
      socket.join([socket.guardId, `guard:${socket.guardId}`]);
      console.log(`Guard ${socket.guardId} joined room`);
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();

    const { init: initTelegram } = require('./services/telegramService');
    initTelegram(io);

    server.listen(PORT, () => {
      console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
    });
  } catch (error) {
    console.error('Backend startup aborted because required services are unavailable.');
    process.exit(1);
  }
};

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use.`);
  } else {
    console.error(`Server error: ${error.message}`);
  }
  process.exit(1);
});

startServer();
