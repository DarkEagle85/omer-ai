import OpenAI from "openai";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

function isSameDay(date1: Date, date2: Date) {
  return (
    date1.getDate() === date2.getDate() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getFullYear() === date2.getFullYear()
  );
}

async function generateTitle(message: string) {
  return message.length > 30
    ? message.slice(0, 30) + "..."
    : message;
}

export async function POST(req: Request) {
  try {
    const authUser = getUserFromRequest(req);

    if (!authUser) {
      return new Response("Yetkisiz", { status: 401 });
    }

    const dbUser = await prisma.user.findUnique({
      where: {
        id: authUser.userId,
      },
    });

    if (!dbUser) {
      return new Response("Kullanıcı bulunamadı", {
        status: 404,
      });
    }

    const now = new Date();

    let usedToday = dbUser.usedMessagesToday;

    if (
      !dbUser.lastMessageDate ||
      !isSameDay(dbUser.lastMessageDate, now)
    ) {
      usedToday = 0;

      await prisma.user.update({
        where: {
          id: dbUser.id,
        },
        data: {
          usedMessagesToday: 0,
          lastMessageDate: now,
        },
      });
    }

    if (usedToday >= dbUser.dailyMessageLimit) {
      return new Response(
        "Günlük mesaj limitin doldu.",
        {
          status: 429,
        }
      );
    }

    const body = await req.json();

    const messages: ChatMessage[] = body.messages || [];
    let conversationId = body.conversationId || null;

    const lastUserMessage =
      messages[messages.length - 1];

    if (!lastUserMessage) {
      return new Response("Mesaj bulunamadı", {
        status: 400,
      });
    }

    if (!conversationId) {
      const title = await generateTitle(
        lastUserMessage.content
      );

      const conversation =
        await prisma.conversation.create({
          data: {
            title,
            userId: authUser.userId,
          },
        });

      conversationId = conversation.id;
    }

    await prisma.message.create({
      data: {
        role: "user",
        content: lastUserMessage.content,
        conversationId,
      },
    });

    const previousMessages =
      await prisma.message.findMany({
        where: {
          conversationId,
        },
        orderBy: {
          createdAt: "asc",
        },
      });

    const completion =
      await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "Sen kısa ve net cevap veren Türkçe AI asistansın.",
          },
          ...previousMessages.map((msg) => ({
            role: msg.role as "user" | "assistant",
            content: msg.content,
          })),
        ],
      });

    const aiResponse =
      completion.choices[0].message.content ||
      "Cevap üretilemedi.";

    await prisma.message.create({
      data: {
        role: "assistant",
        content: aiResponse,
        conversationId,
      },
    });

    await prisma.user.update({
      where: {
        id: dbUser.id,
      },
      data: {
        usedMessagesToday: usedToday + 1,
        lastMessageDate: now,
      },
    });

    return new Response(aiResponse, {
      headers: {
        "Content-Type": "text/plain",
        "X-Conversation-Id": conversationId,
      },
    });
  } catch (error) {
    console.error(error);

    return new Response("AI cevap hatası", {
      status: 500,
    });
  }
}
