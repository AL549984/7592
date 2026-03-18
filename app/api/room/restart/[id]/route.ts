// 禁用静态预渲染，确保每次请求都实时执行
export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: roomId } = await params;

  try {
    const room = await prisma.room.findUnique({ where: { id: roomId }, include: { members: true } });
    if (!room) {
      return NextResponse.json({ error: "房间不存在" }, { status: 404 });
    }

    // 1) 重置房间状态为waiting，所有成员重新可参与
    await prisma.$transaction([
      prisma.room.update({ where: { id: roomId }, data: { status: "waiting" } }),
      prisma.roomMember.updateMany({ where: { roomId }, data: { dicePoints: "[]", isInGame: true } }),
      prisma.gameRound.updateMany({ where: { roomId }, data: { roundStatus: "ended" } }),
    ]);

    const updatedRoom = await prisma.room.findUnique({ where: { id: roomId }, include: { members: { include: { agent: true } } } });
    return NextResponse.json({ success: true, room: updatedRoom });
  } catch (error) {
    console.error("重开房间失败：", error);
    return NextResponse.json({ error: "重开房间失败" }, { status: 500 });
  }
}
