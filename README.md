# Lanka Beacon 🐘🚨

Lanka Beacon — AI-Powered Elephant Early Warning and Community Safety System.

## Project Overview

Lanka Beacon is a Sri Lankan community-safety platform that uses AI camera detection, GPS, live mapping, patrol-area polygons, resident geofencing, Telegram alerts, and notification delivery tracking to reduce risks associated with human–elephant encounters.

## Features

- **Lanka Beacon AI Scanner**: Real-time object detection using TensorFlow.js and COCO-SSD.
- **Guard Management**: Registration, Login, and Profile updates for wildlife guards.
- **Resident Network**: Guards can register local community residents to receive Telegram alerts based on their geofence.
- **Real-time Alerts**: AI-powered detection triggers real-time dashboard updates and Telegram notifications.
- **Lanka Beacon Live Map**: Leaflet.js integration for tracking active elephant locations and patrol boundaries.
- **Alert History**: Comprehensive log of all detections with evidence images and GPS data.
- **Telegram Integration**: Automated alerts sent directly to registered residents.
- **Delivery Tracking**: Monitor the confirmation status of alert relays to residents.

## Tech Stack

- **Frontend**: React, Vite, Tailwind CSS, Leaflet.js, Socket.io Client, TensorFlow.js
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

1. **Register** as a guard with Lanka Beacon.
2. **Define** your patrol area on the map.
3. **Add Residents** in the Resident Network section with their Telegram Chat IDs.
4. **Start the AI Scanner** to begin real-time detection.
5. **Monitor** the Live Map and Delivery Tracking logs for operational updates.

## API Endpoints

- `POST /api/guards/register` - Register a guard
- `POST /api/guards/login` - Login guard
- `GET /api/guards/me` - Get current guard profile
- `POST /api/users` - Register a resident
- `POST /api/alerts` - Create an alert (Protected)
- `GET /api/alerts` - Get all alerts

---
Developed as a university research and community-safety project in Sri Lanka.
