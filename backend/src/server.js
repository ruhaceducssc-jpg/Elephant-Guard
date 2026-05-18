const express = require('express');
const http = require('http');
const socketio = require('socket.io');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db');
const { errorHandler } = require('./middleware/errorMiddleware');

// Load env vars
dotenv.config();

// Connect to database
connectDB();

const app = express();
const server = http.createServer(app);
const io = socketio(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
});

// Pass socket.io to app
app.set('socketio', io);

// Middleware
app.use(express.json());
app.use(cors());

// Static folder for uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/guards', require('./routes/guardRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/alerts', require('./routes/alertRoutes'));
app.use('/api/deliveries', require('./routes/deliveryRoutes'));

// Root route
app.get('/', (req, res) => {
  res.send('Elephant Alert API is running...');
});

// Error Handler
app.use(errorHandler);

// Socket.io connection
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  socket.on('join', (guardId) => {
    if (guardId) {
      socket.join(guardId.toString());
      console.log(`Guard ${guardId} joined room`);
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});
