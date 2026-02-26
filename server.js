const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));

let rooms = {};

// Generate random room code
function generateRoomCode() {
  return Math.random().toString(36).substring(2, 7).toUpperCase();
}

io.on("connection", (socket) => {

  // 🔥 CREATE ROOM
  socket.on("createRoom", () => {
    const code = generateRoomCode();

    rooms[code] = {
      host: socket.id,
      users: [],
      currentTime: 0,
      isPlaying: false
    };

    socket.join(code);
    rooms[code].users.push(socket.id);

    socket.emit("roomCreated", code);
    io.to(code).emit("updateUsers", rooms[code].users.length);
  });

  // 🔥 JOIN ROOM
  socket.on("joinRoom", (code) => {
    if (rooms[code]) {
      socket.join(code);
      rooms[code].users.push(socket.id);

      socket.emit("roomJoined", code);
      io.to(code).emit("updateUsers", rooms[code].users.length);

      // Send current sync state to new user
      socket.emit("syncState", {
        time: rooms[code].currentTime,
        isPlaying: rooms[code].isPlaying
      });
    }
  });

  // 🔥 HOST CONTROLS SYNC
  socket.on("updateState", ({ code, time, isPlaying }) => {
    if (rooms[code] && rooms[code].host === socket.id) {
      rooms[code].currentTime = time;
      rooms[code].isPlaying = isPlaying;

      socket.to(code).emit("syncState", {
        time,
        isPlaying
      });
    }
  });

  // 🔥 DJ SYNC PLAY BUTTON
  socket.on("syncPlay", (code) => {
    if (rooms[code] && rooms[code].host === socket.id) {
      io.to(code).emit("syncState", {
        time: rooms[code].currentTime,
        isPlaying: true
      });
    }
  });

  // 🔥 CHAT SYSTEM
  socket.on("chatMessage", ({ room, msg }) => {
    io.to(room).emit("chatMessage", msg);
  });

  // 🔥 DISCONNECT HANDLING
  socket.on("disconnect", () => {
    for (let code in rooms) {
      if (rooms[code]) {

        rooms[code].users = rooms[code].users.filter(
          id => id !== socket.id
        );

        // If host leaves → delete room
        if (rooms[code].host === socket.id) {
          io.to(code).emit("roomClosed");
          delete rooms[code];
        } 
        else if (rooms[code].users.length === 0) {
          delete rooms[code];
        } 
        else {
          io.to(code).emit("updateUsers", rooms[code].users.length);
        }
      }
    }
  });

});

// ✅ Render Port Fix
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
