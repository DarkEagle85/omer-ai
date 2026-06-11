import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(req: Request, context: RouteContext) {
  try {
    const user = getUserFromRequest(req);

    if (!user) {
      return NextResponse.json(
        { error: "Yetkisiz erişim" },
        { status: 401 }
      );
    }

    const { id } = await context.params;

    const conversation = await prisma.conversation.findFirst({
      where: {
        id,
        userId: user.userId,
      },
      include: {
        messages: {
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });

    return NextResponse.json({
      conversation,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Sohbet detayı alınamadı" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const user = getUserFromRequest(req);

    if (!user) {
      return NextResponse.json(
        { error: "Yetkisiz erişim" },
        { status: 401 }
      );
    }

    const { id } = await context.params;
    const { title } = await req.json();

    if (!title || !title.trim()) {
      return NextResponse.json(
        { error: "Başlık boş olamaz" },
        { status: 400 }
      );
    }

    const conversation = await prisma.conversation.updateMany({
      where: {
        id,
        userId: user.userId,
      },
      data: {
        title: title.trim(),
      },
    });

    if (conversation.count === 0) {
      return NextResponse.json(
        { error: "Sohbet bulunamadı" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Sohbet adı güncellenemedi" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request, context: RouteContext) {
  try {
    const user = getUserFromRequest(req);

    if (!user) {
      return NextResponse.json(
        { error: "Yetkisiz erişim" },
        { status: 401 }
      );
    }

    const { id } = await context.params;

    await prisma.conversation.deleteMany({
      where: {
        id,
        userId: user.userId,
      },
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Sohbet silinemedi" },
      { status: 500 }
    );
  }
}
