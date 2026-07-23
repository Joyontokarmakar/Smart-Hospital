# Smart Hospital Offline LAN Setup & Installation Guide

This document describes how to configure and run the Smart Hospital management system on a local network (LAN) without requiring an active internet connection.

---

## System Requirements

To run this application locally, you must have the following installed on the host computer:
- **Node.js** (v18 or higher recommended): [Download Node.js](https://nodejs.org/)

---

## Step 1: Initial Installation (First-time Setup)

1. Open your terminal (Command Prompt, PowerShell, or Git Bash) and navigate to the project directory.
2. Install the frontend dependencies:
   ```bash
   npm install
   ```
3. Install the local server dependencies:
   ```bash
   cd server
   npm install
   cd ..
   ```

---

## Step 2: Build the Application

Build the static frontend bundle so that the local Express server can host it:
```bash
npm run build
```

---

## Step 3: Run the Local Server

Start the local server. This process acts as the database server, holds APIs, manages uploads, broadcasts real-time notifications via WebSockets, and hosts the frontend:
```bash
npm run server
```

The output should verify:
```text
Local SQLite Database initialized.
Smart Hospital local server running on port 5000
Offline LAN address: http://localhost:5000
```
Keep this terminal window open. If you close this terminal, the system will go offline.

---

## Step 4: Accessing the Application

### Accessing from the Host Computer (Server PC)
Open your browser and go to:
- **URL**: `http://localhost:5000`

### Accessing from other Laptops/PCs on the LAN
1. Connect all computers/laptops to the same local area network (LAN) router or Wi-Fi.
2. Get the local IP address of the Host Computer running the server:
   - **Windows**: Open Command Prompt (`cmd`) and type `ipconfig`. Find your IPv4 Address (e.g., `192.168.1.100`).
   - **macOS/Linux**: Open terminal and type `hostname -I` or `ifconfig`.
3. From any other computer on the LAN, open the browser and navigate to:
   - **URL**: `http://<server-ip>:5000` (e.g., `http://192.168.1.100:5000`)

---

## Connection Settings & Login

### 1. Toggle Connection Mode
Upon loading the page, verify the connection status pill badge in the top-right header:
- Set it to **LAN Offline** (Green pill) to query the local offline database.
- Click it to switch back to **Cloud Mode** (Blue pill) if internet is available and you want to use the cloud database.

### 2. Default Login Credentials (Offline Database)
The local SQLite database comes pre-seeded with a default Administrator user:
- **Email**: `joyonto.karmakar.std@gmail.com`
- **Password**: `SuperAdmin@1234`
