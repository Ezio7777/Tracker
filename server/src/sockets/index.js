const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const User = require('../models/User');

let io = null;

function initSocket(httpServer) {
  io = new Server(httpServer, { cors: { origin: env.clientOrigin, credentials: true } });

  // Every connection must present a valid access token in the handshake.
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth && socket.handshake.auth.token;
      if (!token) return next(new Error('Authentication required'));
      const payload = jwt.verify(token, env.jwtAccessSecret);
      const user = await User.findById(payload.sub);
      if (!user || !user.isActive) return next(new Error('Unauthorized'));
      socket.user = user;
      return next();
    } catch {
      return next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    socket.join(`user:${socket.user._id}`);
    if (socket.user.role === 'ADMIN') socket.join('role:ADMIN');
    socket.emit('ready', { userId: String(socket.user._id) });
  });
  return io;
}

// No-ops when the socket server isn't running (e.g. in tests / seed script).
const emitToUser = (userId, event, payload) => io && io.to(`user:${userId}`).emit(event, payload);
const emitToRole = (role, event, payload) => io && io.to(`role:${role}`).emit(event, payload);
const disconnectUser = (userId) => io && io.in(`user:${userId}`).disconnectSockets(true);

module.exports = { initSocket, emitToUser, emitToRole, disconnectUser };
