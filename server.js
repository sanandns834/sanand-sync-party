const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));

let rooms = {};

io.on("connection", (socket) => {

    socket.on("createRoom", () => {
        const code = Math.floor(1000 + Math.random() * 9000).toString();
        rooms[code] = { users: 1 };
        socket.join(code);
        socket.roomCode = code;
        socket.emit("roomCreated", code);
        io.to(code).emit("updateUsers", rooms[code].users);
    });

    socket.on("joinRoom", (code) => {
        if (rooms[code]) {
            rooms[code].users++;
            socket.join(code);
            socket.roomCode = code;
            socket.emit("joinedRoom", code);
            io.to(code).emit("updateUsers", rooms[code].users);
        }
    });

    socket.on("syncPlay", (code) => {
        io.to(code).emit("playNow");
    });

    socket.on("disconnect", () => {
        const code = socket.roomCode;
        if (code && rooms[code]) {
            rooms[code].users--;
            io.to(code).emit("updateUsers", rooms[code].users);
        }
    });

});

// IMPORTANT: For deployment (Render needs this)
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log("🚀 Sanand's Sync Party running...");
});