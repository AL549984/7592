/**
 * GET /api/secondme/activity  - 获取 SecondMe 每日动态
 * ?date=yyyy-MM-dd  可选，默认今天
 * ?pageNo=1
 * ?pageSize=10
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { getDayOverview } from "@/lib/secondme-api";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const agent = await prisma.secondMeAgent.findUnique({
    where: { id: session.user.id },
    select: { smApiToken: true },
  });

  if (!agent?.smApiToken) {
    return NextResponse.json({ error: "请先连接 SecondMe API" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);

  // date 格式校验：yyyy-MM-dd
  const rawDate = searchParams.get("date");
  const date =
    rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : undefined;

  const pageNo = parseInt(searchParams.get("pageNo") ?? "1", 10);
  const pageSize = parseInt(searchParams.get("pageSize") ?? "10", 10);

  try {
    const result = await getDayOverview(agent.smApiToken, { date, pageNo, pageSize });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
