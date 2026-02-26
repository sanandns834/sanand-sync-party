const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// ==========================
// 📁 Create uploads folder if not exists
// ==========================
if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}

// ==========================
// 📁 Multer Setup
// ==========================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

// Serve static files
app.use(express.static(__dirname));
app.use("/uploads", express.static("uploads"));

// ==========================
// 🎵 Upload Route
// ==========================
app.post("/upload", upload.single("song"), (req, res) => {
  const fileUrl = "/uploads/" + req.file.filename;
  res.json({ url: fileUrl });
});

let rooms = {};

// Generate random room code
function generateRoomCode() {
  return Math.random().toString(36).substring(2, 7).toUpperCase();
}

io.on("connection", (socket) => {

  // ==========================
  // 🔥 CREATE ROOM
  // ==========================
  socket.on("createRoom", () => {
    const code = generateRoomCode();

    rooms[code] = {
      host: socket.id,
      users: [],
      currentTime: 0,
      isPlaying: false,
      currentSong: null
    };

    socket.join(code);
    rooms[code].users.push(socket.id);

    socket.emit("roomCreated", code);
    io.to(code).emit("updateUsers", rooms[code].users.length);
  });

  // ==========================
  // 🔥 JOIN ROOM
  // ==========================
  socket.on("joinRoom", (code) => {
    if (rooms[code]) {
      socket.join(code);
      rooms[code].users.push(socket.id);

      socket.emit("roomJoined", code);
      io.to(code).emit("updateUsers", rooms[code].users.length);

      // Send current sync state
      socket.emit("syncState", {
        time: rooms[code].currentTime,
        isPlaying: rooms[code].isPlaying
      });

      // Send current song if exists
      if (rooms[code].currentSong) {
        socket.emit("loadSong", rooms[code].currentSong);
      }
    }
  });

  // ==========================
  // 🎵 NEW SONG UPLOAD
  // ==========================
  socket.on("newSong", ({ code, url }) => {
    if (rooms[code] && rooms[code].host === socket.id) {

      rooms[code].currentSong = url;
      rooms[code].currentTime = 0;
      rooms[code].isPlaying = true;

      io.to(code).emit("loadSong", url);
    }
  });

  // ==========================
  // 🔄 REAL-TIME SYNC UPDATE
  // ==========================
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

  // ==========================
  // 🎧 DJ SYNC BUTTON
  // ==========================
  socket.on("syncPlay", (code) => {
    if (rooms[code] && rooms[code].host === socket.id) {
      io.to(code).emit("syncState", {
        time: rooms[code].currentTime,
        isPlaying: true
      });
    }
  });

  // ==========================
  // 💬 CHAT SYSTEM
  // ==========================
  socket.on("chatMessage", ({ room, msg }) => {
    io.to(room).emit("chatMessage", msg);
  });

  // ==========================
  // ❌ DISCONNECT
  // ==========================
  socket.on("disconnect", () => {

    for (let code in rooms) {
      if (rooms[code]) {

        rooms[code].users = rooms[code].users.filter(
          id => id !== socket.id
        );

        // If host leaves → close room
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

// ==========================
// ✅ Render Port Fix
// ==========================
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
