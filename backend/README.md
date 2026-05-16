# Elephant Alert Sri Lanka Backend

This is the backend system for the Elephant Alert Sri Lanka university project. It handles Guard authentication, resident management, and real-time elephant detection alerts with Telegram integration.

## Features
- JWT Authentication for Guards
- Resident (Public User) management with GPS locations
- Elephant detection alert processing (Image upload + GPS)
- Real-time notifications via Socket.io
- Automatic Telegram alerts to nearby residents
- Geo-spatial queries with MongoDB

## Tech Stack
- Node.js & Express.js
- MongoDB & Mongoose
- Socket.io (Real-time updates)
- Multer (Image uploads)
- JWT (Authentication)
- Node-Telegram-Bot-API

## API Documentation

### Auth (Guards)
| Method | Endpoint | Description | Request Body |
|--------|----------|-------------|--------------|
| POST | `/api/auth/register` | Register a new guard | `{ name, email, password, assignedArea }` |
| POST | `/api/auth/login` | Login and get JWT | `{ email, password }` |

### Residents (Public Users)
| Method | Endpoint | Description | Auth | Request Body |
|--------|----------|-------------|------|--------------|
| POST | `/api/users` | Add a resident | JWT | `{ name, phone, telegramChatId, longitude, latitude, village }` |
| GET | `/api/users` | Get all residents | JWT | - |

### Alerts (Elephant Detections)
| Method | Endpoint | Description | Auth | Request Body (Form Data) |
|--------|----------|-------------|------|--------------------------|
| POST | `/api/alerts` | Create new alert | JWT | `{ image (file), longitude, latitude, locationName, confidence }` |
| GET | `/api/alerts` | Get all alerts | - | - |

## Setup Instructions
1. Clone the repository.
2. Run `npm install` in the backend folder.
3. Create a `.env` file based on `.env.example`.
4. Run `npm run dev` to start the server.

## Socket.io Events
- `new-elephant-alert`: Emitted to all clients when a new alert is created.
