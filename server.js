// server.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { randomUUID } = require("crypto");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

const waitingQueue = []; // array of socket ids waiting
const pairs = new Map(); // socketId -> partnerSocketId

function pairSockets(aId, bId) {
  const room = randomUUID();
  pairs.set(aId, bId);
  pairs.set(bId, aId);
  io.to(aId).emit("paired", { room, partner: bId });
  io.to(bId).emit("paired", { room, partner: aId });
}

function unpairSocket(socketId) {
  const partnerId = pairs.get(socketId);
  if (!partnerId) return null;
  pairs.delete(socketId);
  pairs.delete(partnerId);
  io.to(partnerId).emit("partner-left");
  return partnerId;
}

io.on("connection", (socket) => {
  console.log(`connect: ${socket.id}`);

  socket.on("join-queue", () => {
    // If already paired, ignore
    if (pairs.has(socket.id)) return;

    // If already in queue don't add again
    if (!waitingQueue.includes(socket.id)) waitingQueue.push(socket.id);

    // If someone else waiting, pair them
    if (waitingQueue.length >= 2) {
      const a = waitingQueue.shift();
      // ensure a is not the same as socket.id (defensive)
      let b = waitingQueue.shift();
      if (a === b) {
        // shouldn't happen; put back and wait
        waitingQueue.unshift(a);
        return;
      }
      pairSockets(a, b);
    } else {
      // notify user they're waiting
      socket.emit("waiting");
    }
  });

  socket.on("signal", (data) => {
    // forward offer/answer/ice to partner
    const partner = pairs.get(socket.id);
    if (partner) {
      io.to(partner).emit("signal", { from: socket.id, data });
    }
  });

  // relay chat messages
socket.on("chat-message", (msg) => {
  const partner = pairs.get(socket.id);
  if (partner) {
    io.to(partner).emit("chat-message", { from: socket.id, msg });
  }
});


  socket.on("skip", () => {
    // If paired: unpair and put partner back in queue
    const partnerId = unpairSocket(socket.id);
    // Put skipping socket back to queue (they want new pair)
    if (!waitingQueue.includes(socket.id)) waitingQueue.push(socket.id);
    // Put partner back in queue (they wait for a new pair)
    if (partnerId && !waitingQueue.includes(partnerId)) {
      waitingQueue.push(partnerId);
      io.to(partnerId).emit("waiting");
    }
    // Try to form pairs if possible
    while (waitingQueue.length >= 2) {
      const a = waitingQueue.shift();
      const b = waitingQueue.shift();
      if (a && b && a !== b) pairSockets(a, b);
      else {
        if (a) waitingQueue.unshift(a);
        if (b) waitingQueue.unshift(b);
        break;
      }
    }
  });

  socket.on("disconnect", () => {
    console.log(`disconnect: ${socket.id}`);
    // Remove from waitingQueue if present
    const idx = waitingQueue.indexOf(socket.id);
    if (idx !== -1) waitingQueue.splice(idx, 1);

    // If paired, unpair and put partner back to waitingQueue
    const partnerId = unpairSocket(socket.id);
    if (partnerId) {
      if (!waitingQueue.includes(partnerId)) waitingQueue.push(partnerId);
      io.to(partnerId).emit("waiting");
    }
  });
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
