# Elephant Alert Sri Lanka 🐘🚨

A full-stack MERN application for monitoring and alerting elephant movements in Sri Lanka to prevent human-elephant conflict.

## Features

- **Guard Management**: Registration, Login, and Profile updates for wildlife guards.
- **Resident Management**: Guards can register local residents to receive Telegram alerts.
- **Real-time Alerts**: AI-powered detection (simulated via API) triggers real-time dashboard updates and Telegram notifications.
- **Live Map**: Leaflet.js integration for tracking active elephant locations.
- **Alert History**: Comprehensive log of all detections with evidence images and GPS data.
- **Telegram Integration**: Automated alerts sent directly to registered residents.

## Tech Stack

- **Frontend**: React, Vite, Tailwind CSS, Leaflet, Socket.io Client
- **Backend**: Node.js, Express, MongoDB, Socket.io, Multer
- **Database**: MongoDB Atlas

## Getting Started

### Prerequisites

- Node.js installed
- MongoDB URI (Atlas or local)
- Telegram Bot Token (from @BotFather)

### Backend Setup

1. Navigate to the backend folder:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file based on `.env.example`:
   ```env
   PORT=5000
   MONGO_URI=your_mongodb_uri
   JWT_SECRET=your_jwt_secret
   TELEGRAM_BOT_TOKEN=your_bot_token
   FRONTEND_URL=http://localhost:5173
   ```
4. Start the server:
   ```bash
   npm run dev
   ```

### Frontend Setup

1. Navigate to the frontend folder:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file:
   ```env
   VITE_API_URL=http://localhost:5000/api
   VITE_SOCKET_URL=http://localhost:5000
   ```
4. Start the development server:
   ```bash
   npm run dev
   ```

## Usage

1. **Register** as a guard.
2. **Login** to access the dashboard.
3. **Add Residents** in the Resident Management section with their Telegram Chat IDs.
4. **View Alerts** on the Live Map and Dashboard.
5. **Simulate Alert**: Send a POST request to `/api/alerts` with an image and coordinates to see real-time updates.

## API Endpoints

- `POST /api/guards/register` - Register a guard
- `POST /api/guards/login` - Login guard
- `GET /api/guards/me` - Get current guard profile
- `POST /api/users` - Register a resident
- `POST /api/alerts` - Create an alert (Protected)
- `GET /api/alerts` - Get all alerts

---
Created for University Project 2026.
