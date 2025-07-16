const { Server } = require("socket.io");
const http = require("http");
const cors = require("cors");
const express = require("express");

const app = express();
app.use(cors({
  origin: ["https://wanesni.com", "http://localhost:3000"], // Add your frontend origins here
  credentials: true
}));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ["https://wanesni.com", "http://localhost:3000"],
    methods: ["GET", "POST"],
    credentials: true
  }
});

io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  // Listen for messages from clients
  socket.on("message", (data) => {
    // Broadcast the message to all clients (or use rooms for private chats)
    io.emit("message", data);
  });

  socket.on("init", (data) => {
    // You can use this to join rooms or authenticate users
    console.log("Init event:", data);
  });

  // Relay typing events
  socket.on("typing", (data) => {
    // Optionally, you can use rooms for private chats
    socket.broadcast.emit("typing", { from: data.from, to: data.to });
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Socket.IO server running on port ${PORT}`);
}); 