import Pusher from 'pusher';
import PusherClient from 'pusher-js';

// Guard server-side initialization to prevent crashes when env vars are missing
const hasServerEnv =
  !!process.env.PUSHER_APP_ID &&
  !!process.env.PUSHER_KEY &&
  !!process.env.PUSHER_SECRET &&
  !!process.env.PUSHER_CLUSTER;

// Export a safe pusherServer. If envs are missing, provide a no-op stub so routes don't crash on import.
export const pusherServer: { trigger: (...args: any[]) => Promise<any> } = hasServerEnv
  ? (new Pusher({
      appId: process.env.PUSHER_APP_ID!,
      key: process.env.PUSHER_KEY!,
      secret: process.env.PUSHER_SECRET!,
      cluster: process.env.PUSHER_CLUSTER!,
      useTLS: true,
    }) as any)
  : {
      // no-op stub to avoid runtime errors in routes that import pusherServer
      trigger: async () => Promise.resolve(),
    };

// Only initialize client in the browser when public envs are present
const isBrowser = typeof window !== 'undefined';
const hasClientEnv =
  isBrowser &&
  !!process.env.NEXT_PUBLIC_PUSHER_KEY &&
  !!process.env.NEXT_PUBLIC_PUSHER_CLUSTER;

export const pusherClient = hasClientEnv
  ? new PusherClient(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
      forceTLS: true,
    })
  : null;