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
        id: true,
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

    const updateData: {
      dailyMessageLimit?: number;
      role?: string;
    } = {};

    if (body.dailyMessageLimit !== undefined) {
      const dailyMessageLimit = Number(body.dailyMessageLimit);

      if (!Number.isFinite(dailyMessageLimit) || dailyMessageLimit < 1) {
        return NextResponse.json(
          { error: "Limit 1 veya daha büyük olmalı" },
          { status: 400 }
        );
      }

      updateData.dailyMessageLimit = dailyMessageLimit;
    }

    if (body.role !== undefined) {
      if (body.role !== "user" && body.role !== "admin") {
        return NextResponse.json(
          { error: "Geçersiz rol" },
          { status: 400 }
        );
      }

      if (id === authUser.userId && body.role !== "admin") {
        return NextResponse.json(
          { error: "Kendi admin yetkini kaldıramazsın" },
          { status: 400 }
        );
      }

      updateData.role = body.role;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "Güncellenecek alan yok" },
        { status: 400 }
      );
    }

    const updatedUser = await prisma.user.update({
      where: {
        id,
      },
      data: updateData,
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
      { error: "Kullanıcı güncellenemedi" },
      { status: 500 }
    );
  }
}
