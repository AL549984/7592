/**
 * GET    /api/secondme/memory          - 搜索 Key Memory
 * POST   /api/secondme/memory          - 新增单条 Key Memory
 * POST   /api/secondme/memory?batch=1  - 批量新增 Key Memory
 * PUT    /api/secondme/memory/[id]     - 更新 Key Memory（本文件处理无 id 的情况）
 * DELETE /api/secondme/memory/[id]     - 删除 Key Memory（本文件处理无 id 的情况）
 *
 * 注：带 memoryId 的操作在 /api/secondme/memory/[id]/route.ts
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import {
  searchKeyMemory,
  insertKeyMemory,
  batchInsertKeyMemory,
} from "@/lib/secondme-api";

async function getToken(userId: string): Promise<string | null> {
  const agent = await prisma.secondMeAgent.findUnique({
    where: { id: userId },
    select: { smApiToken: true },
  });
  return agent?.smApiToken ?? null;
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const token = await getToken(session.user.id);
  if (!token) {
    return NextResponse.json({ error: "请先连接 SecondMe API" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const keyword = searchParams.get("keyword") ?? undefined;
  const pageNo = parseInt(searchParams.get("pageNo") ?? "1", 10);
  const pageSize = parseInt(searchParams.get("pageSize") ?? "20", 10);

  try {
    const result = await searchKeyMemory(token, { keyword, pageNo, pageSize });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const token = await getToken(session.user.id);
  if (!token) {
    return NextResponse.json({ error: "请先连接 SecondMe API" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { searchParams } = new URL(req.url);
  const isBatch = searchParams.get("batch") === "1";

  if (isBatch) {
    const items: { content: string; visibility?: number }[] = body?.items;
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "items 不能为空" }, { status: 400 });
    }
    // 内容长度限制，防止超大请求
    if (items.length > 50) {
      return NextResponse.json({ error: "单次批量最多 50 条" }, { status: 400 });
    }
    try {
      const result = await batchInsertKeyMemory(token, items);
      return NextResponse.json(result);
    } catch (error) {
      return NextResponse.json({ error: String(error) }, { status: 500 });
    }
  }

  const { content, visibility } = body;
  if (!content || typeof content !== "string") {
    return NextResponse.json({ error: "内容不能为空" }, { status: 400 });
  }

  try {
    const result = await insertKeyMemory(token, content, visibility ?? 1);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
