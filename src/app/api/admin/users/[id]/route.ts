import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const authUser = getUserFromRequest(req);

    if (!authUser) {
      return NextResponse.json(
        { error: "Yetkisiz erişim" },
        { status: 401 }
      );
    }

    const admin = await prisma.user.findUnique({
      where: {
        id: authUser.userId,
      },
      select: {
        role: true,
      },
    });

    if (!admin || admin.role !== "admin") {
      return NextResponse.json(
        { error: "Admin yetkisi gerekli" },
        { status: 403 }
      );
    }

    const { id } = await context.params;
    const body = await req.json();

    const dailyMessageLimit = Number(body.dailyMessageLimit);

    if (!Number.isFinite(dailyMessageLimit) || dailyMessageLimit < 1) {
      return NextResponse.json(
        { error: "Limit 1 veya daha büyük olmalı" },
        { status: 400 }
      );
    }

    const updatedUser = await prisma.user.update({
      where: {
        id,
      },
      data: {
        dailyMessageLimit,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        dailyMessageLimit: true,
        usedMessagesToday: true,
      },
    });

    return NextResponse.json({
      user: updatedUser,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Kullanıcı limiti güncellenemedi" },
      { status: 500 }
    );
  }
}
