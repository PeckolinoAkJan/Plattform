import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const awards = [
    { code: "FIRST_DELIVERY", title: "First Delivery", description: "Complete the first valid delivery.", criteria: { deliveries: 1 } },
    { code: "ROAD_1000", title: "Road Veteran", description: "Drive 1,000 valid kilometres.", criteria: { distanceKm: 1000 } },
    { code: "CLEAN_RUN", title: "Clean Run", description: "Finish a delivery without added damage.", criteria: { maxDamageDelta: 0 } },
  ];

  for (const award of awards) {
    await prisma.award.upsert({ where: { code: award.code }, create: award, update: award });
  }
}

main().finally(() => prisma.$disconnect());
