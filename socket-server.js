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

// Store online users
const onlineUsers = new Map(); // socketId -> { userId, firstName, socket }

io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  // Listen for user initialization
  socket.on("init", (data) => {
    console.log("Init event:", data);
    if (data.userId) {
      // Store user as online
      const userInfo = {
        userId: data.userId,
        firstName: data.firstName || data.userId,
        socket: socket
      };
      onlineUsers.set(socket.id, userInfo);
      
      console.log("User added to online users:", userInfo);
      
      // Emit updated online users list to all clients
      const onlineUsersList = Array.from(onlineUsers.values()).map(user => ({
        id: user.userId,
        first_name: user.firstName
      }));
      io.emit("onlineUsers", onlineUsersList);
      
      console.log("Online users list emitted:", onlineUsersList);
      console.log("Total online users:", onlineUsers.size);
    }
  });

  // Listen for messages from clients
  socket.on("message", (data) => {
    // Broadcast the message to all clients (or use rooms for private chats)
    io.emit("message", data);
  });

  // Relay typing events
  socket.on("typing", (data) => {
    // Optionally, you can use rooms for private chats
    socket.broadcast.emit("typing", { from: data.from, to: data.to });
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
    
    // Remove user from online users
    if (onlineUsers.has(socket.id)) {
      onlineUsers.delete(socket.id);
      
      // Emit updated online users list to all clients
      const onlineUsersList = Array.from(onlineUsers.values()).map(user => ({
        id: user.userId,
        first_name: user.firstName
      }));
      io.emit("onlineUsers", onlineUsersList);
      
      console.log("Online users after disconnect:", onlineUsersList);
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Socket.IO server running on port ${PORT}`);
}); 