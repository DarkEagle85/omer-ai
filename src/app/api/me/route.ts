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
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        dailyMessageLimit: true,
        usedMessagesToday: true,
        lastMessageDate: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Kullanıcı bulunamadı" },
        { status: 404 }
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        { error: "Hesabınız pasifleştirilmiş." },
        { status: 403 }
      );
    }

    return NextResponse.json({
      user,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Kullanıcı bilgisi alınamadı" },
      { status: 500 }
    );
  }
}
