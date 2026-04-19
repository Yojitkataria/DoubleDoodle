const jwt = require('jsonwebtoken');
const Room = require('../models/Room');
const Whiteboard = require('../models/Whiteboard');
const User = require('../models/User');

const getRandomColor = () => {
  const letters = '0123456789ABCDEF';
  let color = '#';
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
};

let io;

const initializeSocket = (ioInstance) => {
  io = ioInstance;

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication error'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id);

      if (!user) {
        return next(new Error('Authentication error: User not found'));
      }

      socket.userId = decoded.id;
      socket.userName = decoded.name;
      next();
    } catch (error) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    socket.userColor = getRandomColor();
    console.log(`User connected: ${socket.userName} (${socket.userId}) with color ${socket.userColor}`);

    // Join a whiteboard room
    socket.on('join-whiteboard', async (data) => {
      try {
        const { roomId } = data;

        const room = await Room.findOne({
          roomId,
          isActive: true
        }).populate('whiteboardId');

        if (!room) {
          socket.emit('error', { message: 'Room not found' });
          return;
        }

        // Check if user has access to the whiteboard
        const whiteboard = room.whiteboardId;
        const hasAccess = whiteboard.createdBy.toString() === socket.userId ||
          whiteboard.collaborators.some(c => c.user.toString() === socket.userId);

        if (!hasAccess) {
          socket.emit('error', { message: 'Access denied' });
          return;
        }

        // Join the socket room
        socket.join(roomId);

        // Add or update participant
        const existingParticipantIndex = room.participants.findIndex(
          p => p.user.toString() === socket.userId
        );

        if (existingParticipantIndex >= 0) {
          room.participants[existingParticipantIndex].socketId = socket.id;
          room.participants[existingParticipantIndex].isActive = true;
        } else {
          room.participants.push({
            user: socket.userId,
            userName: socket.userName,
            socketId: socket.id,
            isActive: true
          });
        }

        await room.save();

        // Notify others in the room
        socket.to(roomId).emit('user-joined', {
          userId: socket.userId,
          userName: socket.userName,
          color: socket.userColor
        });

        // Send current participants to the new user
        const activeParticipants = room.participants.filter(p => p.isActive);
        socket.emit('room-participants', activeParticipants);

        console.log(`${socket.userName} joined room: ${roomId}`);
      } catch (error) {
        console.error('Join whiteboard error:', error);
        socket.emit('error', { message: 'Failed to join room' });
      }
    });

    // Handle drawing actions
    socket.on('drawing-action', async (data) => {
      try {
        const { roomId, action } = data || {};
        if (!roomId || !action) return;

        // Broadcast to all users in the room, including the sender
        io.in(roomId).emit('drawing-action', action);

        // Persist ADD actions so late joiners can replay the board.
        if (action.type === 'ADD' && action.data) {
          const room = await Room.findOne({ roomId, isActive: true }).select('whiteboardId');
          if (!room?.whiteboardId) return;

          await Whiteboard.updateOne(
            { _id: room.whiteboardId, isActive: true },
            { $push: { objects: action.data } }
          );
        }
      } catch (error) {
        console.error('drawing-action handler error:', error);
      }
    });

    // Client can request current board state after joining.
    socket.on('request-board-state', async (data) => {
      try {
        const { roomId } = data || {};
        if (!roomId) return;

        const room = await Room.findOne({ roomId, isActive: true }).select('whiteboardId');
        if (!room?.whiteboardId) {
          socket.emit('board-state', { objects: [] });
          return;
        }

        const whiteboard = await Whiteboard.findOne({ _id: room.whiteboardId, isActive: true }).select('objects');
        socket.emit('board-state', { objects: whiteboard?.objects || [] });
      } catch (error) {
        console.error('request-board-state handler error:', error);
        socket.emit('board-state', { objects: [] });
      }
    });

    // Handle cursor movement
    socket.on('cursor-move', (data) => {
      const { roomId, position } = data;
      socket.to(roomId).emit('cursor-moved', {
        userId: socket.userId,
        userName: socket.userName,
        position,
        color: socket.userColor,
      });
    });

    // Handle chat messages
    socket.on('chat-message', (data) => {
      const { roomId, message } = data;
      
      socket.to(roomId).emit('chat-message', {
        userId: socket.userId,
        userName: socket.userName,
        message,
        timestamp: new Date()
      });
    });

    // Handle user typing
    socket.on('typing', (data) => {
      const { roomId, isTyping } = data;
      
      socket.to(roomId).emit('typing', {
        userId: socket.userId,
        userName: socket.userName,
        isTyping
      });
    });

    socket.on('leave-room', async (data) => {
      const { roomId } = data;
      socket.to(roomId).emit('cursor-remove', { userId: socket.userId });
    });

    // Handle disconnection
    socket.on('disconnect', async () => {
      try {
        // Find and update all rooms where this user was a participant
        const rooms = await Room.find({
          'participants.socketId': socket.id
        });

        for (const room of rooms) {
          const participantIndex = room.participants.findIndex(
            p => p.socketId === socket.id
          );

          if (participantIndex >= 0) {
            room.participants[participantIndex].isActive = false;
            await room.save();

            // Notify other users
            socket.to(room.roomId).emit('user-left', {
              userId: socket.userId,
              userName: socket.userName
            });
            socket.to(room.roomId).emit('cursor-remove', { userId: socket.userId });
          }
        }

        console.log(`User disconnected: ${socket.userName} (${socket.userId})`);
      } catch (error) {
        console.error('Disconnect error:', error);
      }
    });
  });

  return io;
};

const getIO = () => {
  if (!io) {
    throw new Error('Socket.io not initialized');
  }
  return io;
};

module.exports = {
  initializeSocket,
  getIO
}; 