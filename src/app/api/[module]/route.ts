import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
const models = {
  programs: prisma.program,
  programParticipations: prisma.programParticipation,
  challengeParticipations: prisma.challengeParticipation,
  breaks: prisma.breakItem,
  pollIdeas: prisma.pollIdea,
  competitorPromotions: prisma.competitorPromotion,
  awardedSongs: prisma.awardedSong,
  xuguedER: prisma.xuguedEREpisode,
  musicRequests: prisma.musicRequest,
  importBatches: prisma.importBatch,
} as const;
type Module = keyof typeof models;
function model(name: string) { return models[name as Module] as any; }
export async function GET(_: Request, { params }: { params: Promise<{ module: string }> }) { const { module } = await params; const m = model(module); if (!m) return NextResponse.json({ error: "Módulo não encontrado" }, { status: 404 }); return NextResponse.json(await m.findMany({ take: 100 })); }
export async function POST(req: Request, { params }: { params: Promise<{ module: string }> }) { const { module } = await params; const m = model(module); if (!m) return NextResponse.json({ error: "Módulo não encontrado" }, { status: 404 }); const data = await req.json(); return NextResponse.json(await m.create({ data }), { status: 201 }); }
