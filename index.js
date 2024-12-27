import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

const rooms = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('createRoom', ({ roomId, playerName }) => {
    console.log('Creating room:', roomId, 'for player:', playerName);
    
    if (rooms.has(roomId)) {
      socket.emit('roomError', 'Room already exists');
      return;
    }

    rooms.set(roomId, {
      players: [{ id: socket.id, name: playerName }],
      gameState: null
    });

    socket.join(roomId);
    socket.emit('roomCreated', { roomId });
  });

  socket.on('joinRoom', ({ roomId, playerName }) => {
    console.log('Joining room:', roomId, 'player:', playerName);
    
    const room = rooms.get(roomId);
    
    if (!room) {
      socket.emit('roomError', 'Room not found');
      return;
    }

    if (room.players.length >= 2) {
      socket.emit('roomError', 'Room is full');
      return;
    }

    room.players.push({ id: socket.id, name: playerName });
    socket.join(roomId);

    io.to(roomId).emit('playerJoined', {
      players: room.players
    });

    if (room.players.length === 2) {
      io.to(roomId).emit('gameStart', {
        players: room.players
      });
    }
  });

  socket.on('move', ({ roomId, move }) => {
    io.to(roomId).emit('moveMade', move);
  });

  socket.on('disconnect', () => {
    rooms.forEach((room, roomId) => {
      const playerIndex = room.players.findIndex(p => p.id === socket.id);
      if (playerIndex !== -1) {
        room.players.splice(playerIndex, 1);
        io.to(roomId).emit('playerLeft', { playerId: socket.id });
        
        if (room.players.length === 0) {
          rooms.delete(roomId);
        }
      }
    });
  });
});

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});