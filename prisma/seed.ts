import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.route.deleteMany();
  await prisma.item.deleteMany();
  await prisma.place.deleteMany();
  await prisma.tripDay.deleteMany();
  await prisma.collaborator.deleteMany();
  await prisma.trip.deleteMany();
  await prisma.user.deleteMany();

  const user = await prisma.user.create({
    data: { name: "Anty", email: "antyk123@gmail.com" },
  });

  const trip = await prisma.trip.create({
    data: {
      ownerId: user.id,
      title: "東京五日自由行",
      startDate: new Date("2026-08-10"),
      endDate: new Date("2026-08-14"),
      status: "planning",
    },
  });

  const day1 = await prisma.tripDay.create({
    data: { tripId: trip.id, date: new Date("2026-08-10"), dayIndex: 1 },
  });

  const sensoji = await prisma.place.create({
    data: {
      name: "淺草寺",
      category: "景點",
      country: "JP",
      address: "東京都台東区浅草2-3-1",
      lat: 35.7148,
      lng: 139.7967,
      rating: 4.5,
      provider: "google",
      externalId: "sensoji-demo",
    },
  });

  const ichiran = await prisma.place.create({
    data: {
      name: "一蘭 淺草店",
      category: "餐廳",
      country: "JP",
      address: "東京都台東区浅草1-1-1",
      lat: 35.7113,
      lng: 139.7967,
      rating: 4.2,
      priceLevel: 2,
      provider: "hotpepper",
      externalId: "ichiran-asakusa-demo",
    },
  });

  const item1 = await prisma.item.create({
    data: {
      dayId: day1.id,
      type: "PLACE",
      placeId: sensoji.id,
      startTime: new Date("2026-08-10T09:00:00"),
      endTime: new Date("2026-08-10T10:30:00"),
      sortOrder: 1,
    },
  });

  const item2 = await prisma.item.create({
    data: {
      dayId: day1.id,
      type: "RESTAURANT",
      placeId: ichiran.id,
      startTime: new Date("2026-08-10T12:00:00"),
      endTime: new Date("2026-08-10T13:00:00"),
      sortOrder: 2,
    },
  });

  await prisma.route.create({
    data: {
      dayId: day1.id,
      fromItemId: item1.id,
      toItemId: item2.id,
      mode: "WALK",
      country: "JP",
      provider: "google",
      durationMin: 12,
      distanceKm: 0.9,
    },
  });

  console.log("Seed complete:", { tripId: trip.id });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
