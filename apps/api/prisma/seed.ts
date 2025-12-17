import { PrismaClient, Role, ContractStatus } from "@prisma/client";
import { hashPassword } from "../src/security/password.js";
import { loadEnv } from "../src/config.js";

const prisma = new PrismaClient();

async function main() {
  loadEnv();
  const usersCount = await prisma.user.count();
  if (usersCount > 0) {
    // eslint-disable-next-line no-console
    console.log("DB already seeded, skipping.");
    return;
  }

  const adminPass = await hashPassword("Admin1234!");
  const clientPass = await hashPassword("Client1234!");

  const admin = await prisma.user.create({
    data: {
      role: Role.admin,
      email: "admin@demo.local",
      phone: "+79990000001",
      passwordHash: adminPass,
      bitrixContactId: "1000",
      allowedDepth: 99
    }
  });

  const client = await prisma.user.create({
    data: {
      role: Role.client,
      email: "client@demo.local",
      phone: "+79990000002",
      passwordHash: clientPass,
      bitrixContactId: "2000",
      allowedDepth: 1
    }
  });

  await prisma.referralEdge.createMany({
    data: [
      { referrerBitrixId: client.bitrixContactId, referredBitrixId: "2001", source: "mock" },
      { referrerBitrixId: client.bitrixContactId, referredBitrixId: "2002", source: "mock" },
      { referrerBitrixId: "2001", referredBitrixId: "2003", source: "mock" }
    ]
  });

  await prisma.contract.createMany({
    data: [
      {
        bitrixDealId: "D-1",
        referredBitrixId: "2001",
        contractDate: new Date("2025-01-10T00:00:00.000Z"),
        rewardAmount: 15000,
        currency: "RUB",
        status: ContractStatus.active,
        source: "mock"
      },
      {
        bitrixDealId: "D-2",
        referredBitrixId: "2002",
        contractDate: new Date("2025-02-01T00:00:00.000Z"),
        rewardAmount: 5000,
        currency: "RUB",
        status: ContractStatus.inactive,
        source: "mock"
      },
      {
        bitrixDealId: "D-3",
        referredBitrixId: "2003",
        contractDate: new Date("2025-03-05T00:00:00.000Z"),
        rewardAmount: 7000,
        currency: "RUB",
        status: ContractStatus.active,
        source: "mock"
      }
    ]
  });

  await prisma.totpSecret.create({
    data: {
      userId: admin.id,
      // For seed we keep plaintext; in prod set APP_ENC_KEY_BASE64 and run setup to rotate.
      secretEnc: "PLEASE_RUN_/auth/mfa/setup",
      enabled: false
    }
  });

  // eslint-disable-next-line no-console
  console.log("Seeded users:");
  // eslint-disable-next-line no-console
  console.log("admin: admin@demo.local / Admin1234!");
  // eslint-disable-next-line no-console
  console.log("client: client@demo.local / Client1234!");
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


