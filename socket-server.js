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

// Random call matchmaking queue
const waitingUsers = [];

// Track active call rooms: roomID -> [userA, userB]
const activeRooms = new Map(); // roomID -> [userA, userB]

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

  // Listen for random call matchmaking
  socket.on("random-call-waiting", (data) => {
    // Prevent duplicate entries
    if (waitingUsers.find(u => u.userId === data.userId)) return;
    waitingUsers.push({ socket, userId: data.userId, name: data.name });
    if (waitingUsers.length >= 2) {
      const userA = waitingUsers.shift();
      const userB = waitingUsers.shift();
      const roomID = 'call-' + Math.random().toString(36).substr(2, 16);
      userA.socket.currentRoomID = roomID;
      userB.socket.currentRoomID = roomID;
      activeRooms.set(roomID, [userA, userB]);
      userA.socket.emit('random-call-match', { roomID });
      userB.socket.emit('random-call-match', { roomID });
      console.log(`Matched users ${userA.userId} and ${userB.userId} in room ${roomID}`);
    }
  });

  // Listen for leaving a call (client should emit this when leaving or ending call)
  socket.on("leave-random-call", () => {
    const roomID = socket.currentRoomID;
    if (!roomID) return;
    const users = activeRooms.get(roomID) || [];
    // Remove this user from the room
    const remainingUsers = users.filter(u => u.socket !== socket);
    activeRooms.set(roomID, remainingUsers);
    delete socket.currentRoomID;
    // If there is a waiting user, match them with the remaining user in the same room
    if (remainingUsers.length === 1 && waitingUsers.length > 0) {
      const nextUser = waitingUsers.shift();
      const stillInRoom = remainingUsers[0];
      nextUser.socket.currentRoomID = roomID;
      activeRooms.set(roomID, [stillInRoom, nextUser]);
      stillInRoom.socket.emit('random-call-match', { roomID });
      nextUser.socket.emit('random-call-match', { roomID });
      console.log(`Rolled in user ${nextUser.userId} to room ${roomID} with ${stillInRoom.userId}`);
    }
    // If no one left, clean up
    if (activeRooms.get(roomID).length === 0) {
      activeRooms.delete(roomID);
    }
  });

  // Listen for messages from clients
  socket.on("message", (data) => {
    // Broadcast the message to all clients (or use rooms for private chats)
    io.emit("message", data);
  });

  // Listen for direct video call invites and relay to the callee
  socket.on("video-call-invite", (data) => {
    // data: { to, from, roomID, callerName }
    for (const [sockId, userInfo] of onlineUsers.entries()) {
      if (userInfo.userId === data.to) {
        userInfo.socket.emit("video-call-invite", data);
        break;
      }
    }
  });

  // Listen for call reject and relay to the caller
  socket.on("video-call-reject", (data) => {
    // data: { to, from, roomID }
    for (const [sockId, userInfo] of onlineUsers.entries()) {
      if (userInfo.userId === data.to) {
        userInfo.socket.emit("video-call-reject", data);
        break;
      }
    }
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
    // Remove from waitingUsers if present
    const idx = waitingUsers.findIndex(u => u.socket === socket);
    if (idx !== -1) waitingUsers.splice(idx, 1);

    // Remove from activeRooms if present
    if (socket.currentRoomID) {
      const roomID = socket.currentRoomID;
      const users = activeRooms.get(roomID) || [];
      const remainingUsers = users.filter(u => u.socket !== socket);
      activeRooms.set(roomID, remainingUsers);
      delete socket.currentRoomID;
      // If there is a waiting user, match them with the remaining user in the same room
      if (remainingUsers.length === 1 && waitingUsers.length > 0) {
        const nextUser = waitingUsers.shift();
        const stillInRoom = remainingUsers[0];
        nextUser.socket.currentRoomID = roomID;
        activeRooms.set(roomID, [stillInRoom, nextUser]);
        stillInRoom.socket.emit('random-call-match', { roomID });
        nextUser.socket.emit('random-call-match', { roomID });
        console.log(`Rolled in user ${nextUser.userId} to room ${roomID} with ${stillInRoom.userId}`);
      }
      // If no one left, clean up
      if (activeRooms.get(roomID).length === 0) {
        activeRooms.delete(roomID);
      }
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Socket.IO server running on port ${PORT}`);
}); 