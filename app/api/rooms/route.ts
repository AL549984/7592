// 固定配置：禁用静态预渲染，必须放在import之后
export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const rooms = await prisma.room.findMany({
      include: { members: { include: { agent: true } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(rooms);
  } catch (error) {
    return NextResponse.json({ error: "获取房间列表失败" }, { status: 500 });
  }
}