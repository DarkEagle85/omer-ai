import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const user = getUserFromRequest(req);

    if (!user) {
      return NextResponse.json(
        { error: "Yetkisiz erişim" },
        { status: 401 }
      );
    }

    const conversations = await prisma.conversation.findMany({
      where: {
        userId: user.userId,
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    return NextResponse.json({ conversations });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Konuşmalar alınamadı" },
      { status: 500 }
    );
  }
}
