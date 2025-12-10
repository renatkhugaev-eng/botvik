import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const quizzes = await prisma.quiz.findMany({
    where: { isActive: true },
    orderBy: [
      { startsAt: "desc" },
      { id: "desc" },
    ],
    select: {
      id: true,
      title: true,
      description: true,
      prizeTitle: true,
    },
  });

  return NextResponse.json(quizzes);
}

