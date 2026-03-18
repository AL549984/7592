import { Server } from 'socket.io'
import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'

export const config = {
  api: {
    bodyParser: false,
  },
}

declare module 'net' {
  interface Socket {
    server: any
  }
}

const ioHandler = (req: NextApiRequest, res: NextApiResponse) => {
  const socket = res.socket as any
  if (!socket.server) {
    return res.status(500).end('Socket服务初始化失败')
  }

  const server = socket.server
  if (!server.io) {
    console.log('Socket.io 服务启动中...')
    const io = new Server(server, {
      path: '/api/socket',
      cors: {
        origin: process.env.NEXT_PUBLIC_URL || '*',
        methods: ['GET', 'POST'],
        credentials: true,
      },
    })

    io.on('connection', (socket) => {
      console.log(`Agent ${socket.id} 已连接`)

      // 1. 创建房间
      socket.on('create_room', async (data: any, callback: any) => {
        const { agentId, roomName, maxAgents } = data
        try {
          const room = await prisma.room.create({
            data: {
              roomName,
              maxAgents: Math.min(Math.max(2, maxAgents), 5),
              status: 'waiting',
              creatorId: agentId,
              members: {
                create: { agentId, isInitiative: true },
              },
            },
            include: { members: { include: { agent: true } } },
          })
          socket.join(room.id)
          callback({ success: true, room })
          io.to(room.id).emit('room_updated', room)
        } catch (error) {
          console.error('创建房间失败：', error)
          callback({ success: false, error: '创建房间失败' })
        }
      })

      // 2. 加入房间
      socket.on('join_room', async (data: any, callback: any) => {
        const { agentId, roomId } = data
        try {
          const room = await prisma.room.findUnique({
            where: { id: roomId },
            include: { members: { include: { agent: true } } },
          })

          if (!room) {
            return callback({ success: false, error: '房间不存在' })
          }
          if (room.status !== 'waiting') {
            return callback({ success: false, error: '游戏已开始，无法加入' })
          }
          if (room.members.length >= room.maxAgents) {
            return callback({ success: false, error: '房间已满' })
          }
          if (room.members.some((m: any) => m.agentId === agentId)) {
            socket.join(roomId)
            return callback({ success: true, room })
          }

          const updatedRoom = await prisma.room.update({
            where: { id: roomId },
            data: {
              members: { create: { agentId } },
            },
            include: { members: { include: { agent: true } } },
          })

          socket.join(roomId)
          callback({ success: true, room: updatedRoom })
          io.to(roomId).emit('room_updated', updatedRoom)
        } catch (error) {
          console.error('加入房间失败：', error)
          callback({ success: false, error: '加入房间失败' })
        }
      })

      // 3. 摇骰
      socket.on('roll_dice', async (data: any, callback: any) => {
        const { agentId, roomId } = data
        try {
          const dicePoints = Array(5).fill(0).map(() => Math.floor(Math.random() * 6) + 1)
          await prisma.roomMember.update({
            where: { roomId_agentId: { roomId, agentId } },
            data: { dicePoints: JSON.stringify(dicePoints) },
          })
          callback({ success: true, dicePoints })
          io.to(roomId).emit('dice_rolled', { agentId })
        } catch (error) {
          console.error('摇骰失败：', error)
          callback({ success: false, error: '摇骰失败' })
        }
      })

      // 4. 叫骰
      socket.on('call_dice', async (data: any, callback: any) => {
        const { agentId, roomId, callNumber, callPoint, isZhai } = data
        try {
          const lastRound = await prisma.gameRound.findFirst({
            where: { roomId, roundStatus: 'calling' },
            orderBy: { createdAt: 'desc' },
          })

          if (lastRound) {
            const isBigger = callNumber > lastRound.callNumber || (callNumber === lastRound.callNumber && callPoint > lastRound.callPoint)
            if (!isBigger) {
              return callback({ success: false, error: '叫骰必须比上一轮大！' })
            }
          }

          let round
          if (!lastRound) {
            round = await prisma.gameRound.create({
              data: {
                roomId,
                callerId: agentId,
                callNumber,
                callPoint,
                isZhai,
                roundStatus: 'calling',
              },
            })
          } else {
            round = await prisma.gameRound.update({
              where: { id: lastRound.id },
              data: { callerId: agentId, callNumber, callPoint, isZhai },
            })
          }

          callback({ success: true, round })
          io.to(roomId).emit('dice_called', { roomId, round })
        } catch (error) {
          console.error('叫骰失败：', error)
          callback({ success: false, error: '叫骰失败' })
        }
      })

      // 5. 开骰
      socket.on('open_dice', async (data: any, callback: any) => {
        const { agentId, roomId, isFanFan } = data
        try {
          const currentRound = await prisma.gameRound.findFirst({
            where: { roomId, roundStatus: 'calling' },
            orderBy: { createdAt: 'desc' },
          })

          if (!currentRound) {
            return callback({ success: false, error: '暂无叫骰，无法开骰' })
          }
          const callerId = currentRound.callerId
          if (callerId === agentId) {
            return callback({ success: false, error: '不能开自己的叫骰' })
          }

          const roomMembers = await prisma.roomMember.findMany({
            where: { roomId, isInGame: true },
            include: { agent: true },
          })
          const allDice = roomMembers.flatMap(m => JSON.parse(m.dicePoints || '[]') as number[])

          const targetPoint = currentRound.callPoint
          const isZhai = currentRound.isZhai
          let totalPoint = 0

          if (isZhai || targetPoint === 1) {
            totalPoint = allDice.filter(p => p === targetPoint).length
          } else {
            const count1 = allDice.filter(p => p === 1).length
            const countTarget = allDice.filter(p => p === targetPoint).length
            totalPoint = count1 + countTarget
          }

          for (const member of roomMembers) {
            const diceList = JSON.parse(member.dicePoints || '[]') as number[]
            const isBaozi = diceList.every((p: number) => p === diceList[0])
            if (isBaozi) {
              totalPoint += isZhai ? 2 : 1
            }
            const isShunzi = new Set(diceList).size === 5 && Math.max(...diceList) - Math.min(...diceList) === 4
            if (isShunzi) {
              totalPoint += 1
            }
          }

          const isCallerWin = totalPoint >= currentRound.callNumber
          const winnerId = isCallerWin ? callerId : agentId
          const loserId = isCallerWin ? agentId : callerId

          let punishPoints = 5
          if (isFanFan === 'pi') punishPoints = 10
          if (isFanFan === 'fanpi') punishPoints = 15

          await prisma.gameRound.update({
            where: { id: currentRound.id },
            data: {
              openerId: agentId,
              totalPoint,
              winnerId,
              loserId,
              punishPoints,
              roundStatus: 'ended',
            },
          })

          await prisma.$transaction(async (tx) => {
            await tx.secondMeAgent.update({
              where: { id: winnerId },
              data: { points: { increment: punishPoints } },
            })
            await tx.secondMeAgent.update({
              where: { id: loserId },
              data: { points: { decrement: punishPoints } },
            })
          })

          await prisma.$transaction(async (tx) => {
            const winnerRecord = await tx.gameRecord.findUnique({ where: { agentId: winnerId } })
            if (winnerRecord) {
              const newWin = winnerRecord.winCount + 1
              const newPlay = winnerRecord.playCount + 1
              await tx.gameRecord.update({
                where: { agentId: winnerId },
                data: {
                  winCount: newWin,
                  playCount: newPlay,
                  winRate: parseFloat(((newWin / newPlay) * 100).toFixed(2)),
                  totalPoints: { increment: punishPoints },
                },
              })
            } else {
              await tx.gameRecord.create({
                data: {
                  agentId: winnerId,
                  winCount: 1,
                  playCount: 1,
                  winRate: 100,
                  totalPoints: punishPoints,
                },
              })
            }

            const loserRecord = await tx.gameRecord.findUnique({ where: { agentId: loserId } })
            if (loserRecord) {
              const newLose = loserRecord.loseCount + 1
              const newPlay = loserRecord.playCount + 1
              await tx.gameRecord.update({
                where: { agentId: loserId },
                data: {
                  loseCount: newLose,
                  playCount: newPlay,
                  winRate: parseFloat((((newPlay - newLose) / newPlay) * 100).toFixed(2)),
                  totalPoints: { decrement: punishPoints },
                },
              })
            } else {
              await tx.gameRecord.create({
                data: {
                  agentId: loserId,
                  loseCount: 1,
                  playCount: 1,
                  winRate: 0,
                  totalPoints: -punishPoints,
                },
              })
            }
          })

          await prisma.room.update({ where: { id: roomId }, data: { status: 'ended' } })

          const updatedRoom = await prisma.room.findUnique({
            where: { id: roomId },
            include: { members: { include: { agent: true } } },
          })
          const winnerRecord = await prisma.gameRecord.findUnique({ where: { agentId: winnerId }, include: { agent: true } })
          const loserRecord = await prisma.gameRecord.findUnique({ where: { agentId: loserId }, include: { agent: true } })

          callback({
            success: true,
            result: {
              winnerId, loserId, totalPoint,
              callNumber: currentRound.callNumber,
              callPoint: currentRound.callPoint,
              isZhai: currentRound.isZhai,
              punishPoints,
              allDice: roomMembers.map(m => ({ agent: m.agent, dice: JSON.parse(m.dicePoints || '[]') as number[] }))
            },
            updatedRoom,
            winnerRecord,
            loserRecord,
          })

          io.to(roomId).emit('dice_opened', {
            roomId,
            result: {
              winnerId, loserId, totalPoint,
              callNumber: currentRound.callNumber,
              callPoint: currentRound.callPoint,
              isZhai: currentRound.isZhai,
              punishPoints,
              allDice: roomMembers.map(m => ({ agent: m.agent, dice: JSON.parse(m.dicePoints || '[]') as number[] }))
            },
            updatedRoom,
            winnerRecord,
            loserRecord,
          })
        } catch (error) {
          console.error('开骰失败：', error)
          callback({ success: false, error: '开骰失败' })
        }
      })

      // 6. 退出房间
      socket.on('leave_room', async (data: any, callback: any) => {
        const { agentId, roomId } = data
        try {
          await prisma.roomMember.delete({
            where: { roomId_agentId: { roomId, agentId } },
          })
          const memberCount = await prisma.roomMember.count({ where: { roomId } })
          if (memberCount === 0) {
            await prisma.room.delete({ where: { id: roomId } })
          } else {
            // 先将所有成员权重归零，防止出现多个房主
            await prisma.roomMember.updateMany({ where: { roomId }, data: { isInitiative: false } })
            const firstMember = await prisma.roomMember.findFirst({ where: { roomId } })
            if (firstMember) {
              await prisma.roomMember.update({
                where: { id: firstMember.id },
                data: { isInitiative: true },
              })
            }
          }
          socket.leave(roomId)
          callback({ success: true })
          const updatedRoom = await prisma.room.findUnique({
            where: { id: roomId },
            include: { members: { include: { agent: true } } },
          })
          if (updatedRoom) {
            io.to(roomId).emit('room_updated', updatedRoom)
          }
        } catch (error) {
          console.error('退出房间失败：', error)
          callback({ success: false, error: '退出房间失败' })
        }
      })

      socket.on('disconnect', () => {
        console.log(`Agent ${socket.id} 断开连接`)
      })
    })

    server.io = io
  }

  res.end()
}

export default ioHandler