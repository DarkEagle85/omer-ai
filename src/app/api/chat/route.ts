import OpenAI from "openai";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export async function POST(req: Request) {
  try {
    const user = getUserFromRequest(req);

    if (!user) {
      return new Response("Yetkisiz erişim", {
        status: 401,
      });
    }

    const body = await req.json();

    const messages: ChatMessage[] = body.messages || [];
    let conversationId: string | null = body.conversationId || null;

    const lastUserMessage = messages[messages.length - 1];

    if (!lastUserMessage || lastUserMessage.role !== "user") {
      return new Response("Kullanıcı mesajı bulunamadı.", {
        status: 400,
      });
    }

    if (!conversationId) {
      const title =
        lastUserMessage.content.length > 40
          ? lastUserMessage.content.slice(0, 40) + "..."
          : lastUserMessage.content;

      const conversation = await prisma.conversation.create({
        data: {
          title,
          userId: user.userId,
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

    const stream = await client.responses.stream({
      model: "gpt-5.5",
      input: [
        {
          role: "system",
          content:
            "Sen Türkçe konuşan kısa, net ve pratik bir yapay zeka asistanısın. Kod istendiğinde kısa açıklama yap ve minimum çalışan kod ver. Kodları Markdown code block içinde yaz.",
        },
        ...messages,
      ],
    });

    const encoder = new TextEncoder();
    let fullResponse = "";

    const readableStream = new ReadableStream({
      async start(controller) {
        for await (const event of stream) {
          if (event.type === "response.output_text.delta") {
            const chunk = event.delta;
            fullResponse += chunk;
            controller.enqueue(encoder.encode(chunk));
          }
        }

        await prisma.message.create({
          data: {
            role: "assistant",
            content: fullResponse,
            conversationId,
          },
        });

        controller.close();
      },
    });

    return new Response(readableStream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  } catch (error) {
    console.error(error);

    return new Response("AI cevap hatası", {
      status: 500,
    });
  }
}
