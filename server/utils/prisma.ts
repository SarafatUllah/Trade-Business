import { PrismaClient } from '@prisma/client'

// Nitro can hot-reload server code in dev; keep a single PrismaClient
// instance across reloads to avoid exhausting database connections.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error']
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
