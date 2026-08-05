import { PrismaClient, RoleName } from "@prisma/client";
import { maskCpf, normalizePhone, normalizeTitle } from "../src/lib/normalizers";
const prisma = new PrismaClient();
const programs = ["Desafio RD", "Trio Rádio Disney", "Canta Aí", "WhatsApp Liberado", "8 Melhores"];
async function main() {
  await prisma.$transaction([prisma.importError.deleteMany(), prisma.importBatch.deleteMany(), prisma.auditLog.deleteMany(), prisma.challengeWinnerDetails.deleteMany(), prisma.challengeParticipation.deleteMany(), prisma.listener.deleteMany(), prisma.programParticipation.deleteMany(), prisma.musicRequest.deleteMany(), prisma.program.deleteMany(), prisma.seasonalPromotion.deleteMany(), prisma.competitorPromotion.deleteMany(), prisma.competitorRadio.deleteMany(), prisma.awardedSong.deleteMany(), prisma.breakItem.deleteMany(), prisma.pollIdea.deleteMany(), prisma.xuguedEREpisode.deleteMany(), prisma.user.deleteMany(), prisma.role.deleteMany()]);
  const roleMap = new Map<RoleName,string>();
  for (const name of ["ADMIN", "PRODUCAO", "ANALISTA", "PUBLICO"] as RoleName[]) roleMap.set(name, (await prisma.role.create({ data: { name } })).id);
  const admin = await prisma.user.create({ data: { name: "Administrador Demo", email: "admin.demo@radiod.local", roleId: roleMap.get("ADMIN")! } });
  const programRows = await Promise.all(programs.map((name) => prisma.program.create({ data: { name, slug: name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") } })));
  for (let d = 1; d <= 5; d++) for (const time of ["11:25", "17:30"]) {
    const listener = await prisma.listener.create({ data: { name: `Ouvinte Demo ${d}-${time}`, phoneOriginal: `(11) 9000${d}-${time === "11:25" ? "1125" : "1730"}`, phoneNormalized: normalizePhone(`9000${d}${time === "11:25" ? "1125" : "1730"}`), sourceFile: "seed fictício" } });
    const participation = await prisma.challengeParticipation.create({ data: { date: `2026-08-0${d}`, time, listenerId: listener.id, score: (d * 10) + (time === "17:30" ? 20 : 0), winner: d === 3 && time === "17:30", sourceSheet: "DEMO" } });
    if (participation.winner) await prisma.challengeWinnerDetails.create({ data: { participationId: participation.id, fullName: "Vencedor Demo Protegido", email: "vencedor.demo@radiod.local", cpfMasked: maskCpf("12345678909")!, appDownloaded: true } });
  }
  for (let m = 5; m <= 7; m++) for (let d = 1; d <= 12; d++) for (const [i, p] of programRows.entries()) await prisma.programParticipation.create({ data: { date: `2026-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`, programId: p.id, quantity: 20 + m + d + i * 3, sourceSheet: "DEMO" } });
  for (let i = 1; i <= 20; i++) await prisma.musicRequest.create({ data: { artistOriginal: `artista demo ${i%6}`, artistNormalized: normalizeTitle(`artista demo ${i%6}`), songOriginal: i % 5 === 0 ? "Sem Música" : `música demo ${i}`, songNormalized: normalizeTitle(i % 5 === 0 ? "Sem Música" : `música demo ${i}`), quantity: 1 + (i % 9), programId: programRows[i % programRows.length].id } });
  for (let i = 1; i <= 8; i++) await prisma.xuguedEREpisode.create({ data: { episodeNumber: i, theme: `Tema editorial ${i}`, character: ["Jackson","Mary Help","Mustafary","Silas"][i%4], airedDate: `2026-07-${String(i+1).padStart(2,"0")}` } });
  const radios = await Promise.all(["Band FM","Mix FM","Transamérica","Jovem Pan"].map(name => prisma.competitorRadio.create({ data: { name } })));
  for (let i=1;i<=10;i++) await prisma.competitorPromotion.create({ data:{ radioId: radios[i%4].id, title:`Promoção concorrente demo ${i}`, duration:"Durante a semana", mechanic:"Cadastro via dial, redes sociais ou site com sorteio auditável.", channel:["Dial","Redes sociais","Site","Dial/Site"][i%4], referenceMonth:`2026-${String(5+(i%3)).padStart(2,"0")}`, status:i%2?"Ativa":"Encerrada", tags:i%3===0?"show,artista":"dinheiro,produto" } });
  for (let i=1;i<=15;i++) await prisma.awardedSong.create({ data:{ day:`2026-07-${String(i).padStart(2,"0")}`, position:(i%8)+1, songOriginal:`Música premiada demo ${i} - Artista ${i%4}`, artist:`Artista ${i%4}`, title:`Música premiada demo ${i}`, referenceMonth:"2026-07" } });
  for (let i=1;i<=8;i++) await prisma.breakItem.create({ data:{ name:`CH PROMO DEMO ${i}`, weekdays:i%2?"Seg-Sex":"Todos os dias", frequencyComment:i%2?"07X":"Intercalar", entryDate:`2026-07-${String(i).padStart(2,"0")}`, exitDate:`2026-08-${String(i+5).padStart(2,"0")}`, status:i<=5?"NO_AR":"SAIU_DO_AR" } });
  for (let i=1;i<=10;i++) await prisma.pollIdea.create({ data:{ date:`2026-08-${String(i).padStart(2,"0")}`, onAirPoll:i%2?`Enquete do ar demo ${i}`:null, suggestion:`Sugestão Comenta Aí demo ${i}`, reason:"Gancho editorial fictício", participations:30+i, referenceWeek:"03_A_07_DE_AGOSTO", status:i%3===0?"FOI_AO_AR":"IDEIA" } });
  await prisma.auditLog.create({ data: { actorId: admin.id, entity: "Seed", entityId: "demo", action: "CREATE_DEMO_DATA", sensitive: true, after: { aviso: "Dados fictícios; histórico real não importado" } } });
}
main().finally(() => prisma.$disconnect());
