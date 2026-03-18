/**
 * PUT    /api/secondme/memory/[id]  - 更新 Key Memory
 * DELETE /api/secondme/memory/[id]  - 删除 Key Memory
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { updateKeyMemory, deleteKeyMemory } from "@/lib/secondme-api";

async function getToken(userId: string): Promise<string | null> {
  const agent = await prisma.secondMeAgent.findUnique({
    where: { id: userId },
    select: { smApiToken: true },
  });
  return agent?.smApiToken ?? null;
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const token = await getToken(session.user.id);
  if (!token) {
    return NextResponse.json({ error: "请先连接 SecondMe API" }, { status: 403 });
  }

  const { id } = await params;
  const memoryId = parseInt(id, 10);
  if (isNaN(memoryId)) {
    return NextResponse.json({ error: "无效的 memoryId" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const { content, visibility } = body;
  if (!content || typeof content !== "string") {
    return NextResponse.json({ error: "内容不能为空" }, { status: 400 });
  }

  try {
    const result = await updateKeyMemory(token, memoryId, content, visibility ?? 1);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const token = await getToken(session.user.id);
  if (!token) {
    return NextResponse.json({ error: "请先连接 SecondMe API" }, { status: 403 });
  }

  const { id } = await params;
  const memoryId = parseInt(id, 10);
  if (isNaN(memoryId)) {
    return NextResponse.json({ error: "无效的 memoryId" }, { status: 400 });
  }

  try {
    await deleteKeyMemory(token, memoryId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
