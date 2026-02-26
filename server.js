const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));

let rooms = {};

function generateRoomCode() {
  return Math.random().toString(36).substring(2, 7).toUpperCase();
}

io.on("connection", (socket) => {

  socket.on("createRoom", () => {
    const code = generateRoomCode();
    rooms[code] = {
      host: socket.id,
      users: []
    };

    socket.join(code);
    rooms[code].users.push(socket.id);

    socket.emit("roomCreated", code);
    io.to(code).emit("updateUsers", rooms[code].users.length);
  });

  socket.on("joinRoom", (code) => {
    if (rooms[code]) {
      socket.join(code);
      rooms[code].users.push(socket.id);

      socket.emit("roomJoined", code);
      io.to(code).emit("updateUsers", rooms[code].users.length);
    }
  });

  socket.on("syncPlay", (code) => {
    if (rooms[code] && rooms[code].host === socket.id) {
      io.to(code).emit("playNow");
    }
  });

  socket.on("disconnect", () => {
    for (let code in rooms) {
      if (rooms[code]) {
        rooms[code].users = rooms[code].users.filter(id => id !== socket.id);

        if (rooms[code].users.length === 0) {
          delete rooms[code];
        } else {
          io.to(code).emit("updateUsers", rooms[code].users.length);
        }
      }
    }
  });

});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
