// Simple WebSocket (Socket.IO) emitter for server-side API routes
// It accesses the Socket.IO server instance attached to the global object by server.js

// Type-safe global accessor
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getIO = (): any | null => {
  // Using globalThis to share the io instance across Next API route modules and the custom server
  // server.js MUST set globalThis.wsIO = io
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g: any = globalThis as any;
  return g.wsIO || null;
};

export const wsEmit = (room: string, event: string, payload: any): void => {
  const io = getIO();
  if (!io) {
    // No-op when IO is not initialized
    return;
  }
  try {
    io.to(room).emit(event, payload);
  } catch (e) {
    // Silently ignore errors to avoid breaking API routes
    // Optionally log in the future
  }
};

export const getSocketServer = () => getIO();