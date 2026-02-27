# Book-a-Cut (Barber Booking System)

A full-stack mobile application that allows customers to book appointments with barbers, and barbers to manage their profiles, services, and schedules. The system supports different service modes, including salon visits and home services.

## Architecture

The project is divided into two main parts:
- **Backend**: A Node.js and Express RESTful API with MongoDB, providing real-time features using Socket.IO.
- **Frontend (book-a-cut)**: A React Native application built with Expo for Android and iOS.

---

## 🚀 Features

### For Customers
- Browse available barbers.
- Filter barbers by service mode (Salon or Home).
- View barber profiles, services, pricing, and reviews.
- Book appointments (Select Date and Time).
- Rate and review previous haircuts and services.
- Real-time updates and notifications.

### For Barbers
- Manage profile information, bio, and working hours.
- Manage services offered and pricing.
- Specify supported service modes (Salon only, Home only, or Both).
- View and manage upcoming appointments.

---

## 🛠️ Tech Stack

**Frontend:**
- [React Native](https://reactnative.dev/)
- [Expo](https://expo.dev/)
- [React Navigation](https://reactnavigation.org/)
- UI rendering and safe area handling through `react-native-safe-area-context` and `react-native-reanimated`.
- Socket.IO-client for real-time reactivity.
- Map viewing and interactions with `react-native-maps`.

**Backend:**
- [Node.js](https://nodejs.org/) & [Express](https://expressjs.com/)
- [MongoDB](https://www.mongodb.com/) & Mongoose for Data Modeling.
- Socket.IO for real-time socket connections.
- JWT (`jsonwebtoken`) for authentication and authorization.
- `bcryptjs` for secure password hashing.
- `nodemailer` for email communications.

---

## 📦 Installation & Setup

### Prerequisites
- Node.js (v18+ recommended)
- MongoDB Server (or MongoDB Atlas)
- Expo CLI / Expo Go app on your physical device for testing.

### 1. Clone the repository
Ensure you have the code downloaded or cloned to your local machine.

### 2. Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Environment Configuration: Create a `.env` file in the `backend` folder and configure the necessary environment variables:
   ```env
   PORT=3000
   MONGODB_URI=your_mongodb_connection_string
   JWT_SECRET=your_jwt_secret_key
   # Add any other required keys (e.g., for nodemailer)
   ```
4. Start the backend development server:
   ```bash
   npm run dev
   ```
   *(Running `npm run dev` starts the server using `nodemon` for auto-reloading).*

### 3. Frontend Setup
1. Navigate to the frontend directory:
   ```bash
   cd book-a-cut
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Network Configuration:
   *Make sure your mobile device and your development computer are on the same Wi-Fi network.*
   Depending on your setup, you might need to update the base URL in your frontend's API config file to match your backend's local IP address (e.g., `http://192.168.x.x:3000`).

4. Start the Expo app:
   ```bash
   npm start
   ```
   *or if you need tunnel access (e.g., working behind strict firewalls):*
   ```bash
   npm run tunnel
   ```

5. Run on device:
   - **Android / iOS:** Open the **Expo Go** app on your phone and scan the QR code displayed in the terminal.

---

## 📜 Scripts overview

**Backend** (`backend/package.json`):
- `npm run dev`: Starts the server with `nodemon`.
- `npm start`: Starts the server with node.
- `npm run tunnel`: Uses localtunnel to expose the local server to a public URL (`book-a-cut-app`).

**Frontend** (`book-a-cut/package.json`):
- `npm start`: Standard Expo start.
- `npm run tunnel`: Starts Expo with an ngrok tunnel.
- `npm run android` / `npm run ios`: Compiles and runs the native project on simulators/devices.

---

## 🤝 Contribution / Development
When making changes, please ensure that you update the relevant schemas in the backend (`backend/src/models`) if the data structure changes, and reflect those changes in the UI inside the `book-a-cut/src/screens` components.
