import { PrismaClient as PrismaClientNode } from '@prisma/client';
import { PrismaClient as PrismaClientEdge } from '@prisma/client/edge';
import { withAccelerate } from '@prisma/extension-accelerate';

const isEdgeRuntime = typeof (globalThis as any).EdgeRuntime !== 'undefined';
const isAccelerateUrl = process.env.DATABASE_URL?.startsWith('prisma+');

let prisma: any;

if (isEdgeRuntime && isAccelerateUrl) {
  // Use Edge Accelerate client only in Edge runtime
  prisma = new PrismaClientEdge({
    datasourceUrl: process.env.DATABASE_URL,
  }).$extends(withAccelerate());
} else {
  // Use Node client with direct connection locally/server
  const globalForPrisma = global as unknown as { prisma?: PrismaClientNode };
  const datasourceUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;

  // Reuse a single Prisma client in dev to avoid exhausting DB connections during hot reloads
  const client = globalForPrisma.prisma ?? new PrismaClientNode({
    datasourceUrl,
    // log: [],
  });

  if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = client;
  }

  prisma = client;
}

export default prisma;