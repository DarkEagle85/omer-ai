import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const authUser = getUserFromRequest(req);

    if (!authUser) {
      return NextResponse.json(
        { error: "Yetkisiz erişim" },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: {
        id: authUser.userId,
      },
      select: {
        role: true,
      },
    });

    if (!user || user.role !== "admin") {
      return NextResponse.json(
        { error: "Admin yetkisi gerekli" },
        { status: 403 }
      );
    }

    const [totalUsers, totalConversations, totalMessages] =
      await Promise.all([
        prisma.user.count(),
        prisma.conversation.count(),
        prisma.message.count(),
      ]);

    const users = await prisma.user.findMany({
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        dailyMessageLimit: true,
        usedMessagesToday: true,
        createdAt: true,
      },
      take: 50,
    });

    return NextResponse.json({
      totalUsers,
      totalConversations,
      totalMessages,
      users,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Admin istatistikleri alınamadı" },
      { status: 500 }
    );
  }
}