import { PrismaClient } from '@prisma/client'

// Prisma 5.x 稳定版标准写法：先取全局已有实例，避免热重载时重复创建连接
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

export { prisma }