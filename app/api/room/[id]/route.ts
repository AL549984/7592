// 固定配置：禁用静态预渲染，必须放在import之后
export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: roomId } = await params;
  try {
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: { members: { include: { agent: true } } },
    });
    if (!room) return NextResponse.json({ error: "房间不存在" }, { status: 404 });
    return NextResponse.json(room);
  } catch (error) {
    return NextResponse.json({ error: "获取房间详情失败" }, { status: 500 });
  }
}