/**
 * GET /api/secondme/discover  - Discover 发现用户
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { discoverUsers } from "@/lib/secondme-api";

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
  const pageNo = parseInt(searchParams.get("pageNo") ?? "1", 10);
  const pageSize = parseInt(searchParams.get("pageSize") ?? "20", 10);

  try {
    const result = await discoverUsers(agent.smApiToken, { pageNo, pageSize });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
