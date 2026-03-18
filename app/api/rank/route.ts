// 固定配置：禁用静态预渲染，必须放在import之后
export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const rankList = await prisma.gameRecord.findMany({
      include: { agent: true },
      orderBy: [
        { winRate: "desc" },
        { totalPoints: "desc" },
      ],
    });
    return NextResponse.json(rankList);
  } catch (error) {
    return NextResponse.json({ error: "获取排名失败" }, { status: 500 });
  }
}