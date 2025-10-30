const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = process.env.PORT || 3000;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  // Initialize Socket.IO server
  const { Server } = require('socket.io');
  const jwt = require('jsonwebtoken');
  const io = new Server(server, {
    path: '/socket.io',
    cors: { origin: '*', methods: ['GET', 'POST'] },
  });

  // Attach to global for API routes access
  globalThis.wsIO = io;

  // Presence tracking: roomId(string) -> Set of userIds(string)
  const presenceRooms = new Map();

  const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

  io.use((socket, next) => {
    try {
      const auth = socket.handshake.auth || {};
      let token = auth.token;
      if (!token) {
        const hdr = socket.handshake.headers['authorization'];
        if (hdr && typeof hdr === 'string' && hdr.startsWith('Bearer ')) {
          token = hdr.substring(7);
        }
      }
      if (!token) return next(new Error('Unauthorized'));
      const decoded = jwt.verify(token, JWT_SECRET);
      if (!decoded || !decoded.userId) return next(new Error('Unauthorized'));
      socket.data.user = {
        id: decoded.userId,
        full_name: decoded.full_name || 'User',
        role: decoded.role || 'user',
      };
      next();
    } catch (e) {
      next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const user = socket.data.user;

    // Track joined presence rooms for cleanup
    const joinedPresence = new Set();

    // Notifications: join user's private channel
    socket.on('join-notifications', (userId) => {
      if (!user || String(user.id) !== String(userId)) return;
      socket.join(`private-notifications-user-${userId}`);
    });

    // Chat: join/leave a private chat room
    socket.on('join-chat-room', (roomId) => {
      socket.join(`private-chat-room-${roomId}`);
    });
    socket.on('leave-chat-room', (roomId) => {
      socket.leave(`private-chat-room-${roomId}`);
    });

    // Presence: join a presence room and update members
    const emitPresenceState = (room) => {
      const members = Array.from(presenceRooms.get(room) || new Set());
      io.to(room).emit('presence:state', { room, members });
    };

    socket.on('join-presence-room', (roomId) => {
      const room = `presence-chat-room-${roomId}`;
      socket.join(room);
      joinedPresence.add(room);
      if (!presenceRooms.has(room)) presenceRooms.set(room, new Set());
      const set = presenceRooms.get(room);
      set.add(String(user.id));
      io.to(room).emit('presence:member_added', { room, id: String(user.id) });
      emitPresenceState(room);
    });

    socket.on('leave-presence-room', (roomId) => {
      const room = `presence-chat-room-${roomId}`;
      socket.leave(room);
      joinedPresence.delete(room);
      const set = presenceRooms.get(room);
      if (set) {
        set.delete(String(user.id));
        io.to(room).emit('presence:member_removed', { room, id: String(user.id) });
        emitPresenceState(room);
      }
    });

    socket.on('disconnect', () => {
      // Cleanup presence membership
      joinedPresence.forEach((room) => {
        const set = presenceRooms.get(room);
        if (set) {
          set.delete(String(user.id));
          io.to(room).emit('presence:member_removed', { room, id: String(user.id) });
          emitPresenceState(room);
        }
      });
    });
  });

  server.listen(port, (err) => {
    if (err) throw err;
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});