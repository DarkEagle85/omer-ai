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
  return message.length > 30 ? message.slice(0, 30) + "..." : message;
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

    if (!dbUser.isActive) {
      return new Response("Hesabınız pasifleştirilmiş.", {
        status: 403,
      });
    }

    const now = new Date();

    let usedToday = dbUser.usedMessagesToday;

    if (!dbUser.lastMessageDate || !isSameDay(dbUser.lastMessageDate, now)) {
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
      return new Response("Günlük mesaj limitin doldu.", {
        status: 429,
        headers: {
          "X-Daily-Limit": String(dbUser.dailyMessageLimit),
          "X-Daily-Used": String(usedToday),
        },
      });
    }

    const body = await req.json();

    const messages: ChatMessage[] = body.messages || [];
    let conversationId: string | null = body.conversationId || null;

    const lastUserMessage = messages[messages.length - 1];

    if (!lastUserMessage || lastUserMessage.role !== "user") {
      return new Response("Mesaj bulunamadı", {
        status: 400,
      });
    }

    if (!conversationId) {
      const title = await generateTitle(lastUserMessage.content);

      const conversation = await prisma.conversation.create({
        data: {
          title,
          userId: authUser.userId,
        },
      });

      conversationId = conversation.id;
    }

    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        userId: authUser.userId,
      },
    });

    if (!conversation) {
      return new Response("Sohbet bulunamadı", {
        status: 404,
      });
    }

    await prisma.message.create({
      data: {
        role: "user",
        content: lastUserMessage.content,
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

    const previousMessages = await prisma.message.findMany({
      where: {
        conversationId,
      },
      orderBy: {
        createdAt: "asc",
      },
      take: 20,
    });

    const stream = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      stream: true,
      messages: [
        {
          role: "system",
          content:
            "Sen kısa, net ve pratik cevap veren Türkçe AI asistansın. Kod istendiğinde Markdown code block içinde yaz.",
        },
        ...previousMessages.map((msg) => ({
          role: msg.role as "user" | "assistant",
          content: msg.content,
        })),
      ],
    });

    const encoder = new TextEncoder();
    let fullResponse = "";

    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const part of stream) {
            const chunk = part.choices[0]?.delta?.content || "";

            if (chunk) {
              fullResponse += chunk;
              controller.enqueue(encoder.encode(chunk));
            }
          }

          await prisma.message.create({
            data: {
              role: "assistant",
              content: fullResponse || "Cevap üretilemedi.",
              conversationId: conversationId as string,
            },
          });

          controller.close();
        } catch (error) {
          console.error(error);
          controller.error(error);
        }
      },
    });

    return new Response(readableStream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Conversation-Id": conversationId,
        "X-Daily-Limit": String(dbUser.dailyMessageLimit),
        "X-Daily-Used": String(usedToday + 1),
      },
    });
  } catch (error) {
    console.error(error);

    return new Response("AI cevap hatası", {
      status: 500,
    });
  }
}