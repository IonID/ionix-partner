import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // ── Default Settings ──────────────────────────────────────────────
  const settings = [
    { key: 'CLASSIC_MONTHLY_RATE', value: '0.0299', type: 'number', label: 'Rată lunară Credit Clasic (%)', description: 'Rata lunară a dobânzii pentru Credit Clasic (ex: 0.0299 = 2.99%)' },
    { key: 'CLASSIC_MIN_AMOUNT', value: '1000', type: 'number', label: 'Suma minimă Credit Clasic (MDL)' },
    { key: 'CLASSIC_MAX_AMOUNT', value: '50000', type: 'number', label: 'Suma maximă Credit Clasic (MDL)' },
    { key: 'CLASSIC_MIN_MONTHS', value: '3', type: 'number', label: 'Termen minim Credit Clasic (luni)' },
    { key: 'CLASSIC_MAX_MONTHS', value: '24', type: 'number', label: 'Termen maxim Credit Clasic (luni)' },
    { key: 'ZERO_MIN_AMOUNT', value: '500', type: 'number', label: 'Suma minimă Credit Zero (MDL)' },
    { key: 'ZERO_MAX_AMOUNT', value: '10000', type: 'number', label: 'Suma maximă Credit Zero (MDL)' },
    { key: 'ZERO_MIN_MONTHS', value: '3', type: 'number', label: 'Termen minim Credit Zero (luni)' },
    { key: 'ZERO_MAX_MONTHS', value: '12', type: 'number', label: 'Termen maxim Credit Zero (luni)' },
    { key: 'PROCESSING_FEE_RATE', value: '0.01', type: 'number', label: 'Comision procesare (%)', description: 'Comision unic de procesare aplicat la suma creditului' },
    { key: 'TELEGRAM_ENABLED', value: 'true', type: 'boolean', label: 'Notificări Telegram active' },
  ];

  for (const s of settings) {
    await prisma.setting.upsert({
      where: { key: s.key },
      update: {},
      create: s,
    });
  }
  console.log(`✅ ${settings.length} settings seeded`);

  // ── Admin User ────────────────────────────────────────────────────
  const adminPassword = await bcrypt.hash('Admin@Ionix2024!', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@pin.md' },
    update: {},
    create: {
      email: 'admin@pin.md',
      password: adminPassword,
      firstName: 'Ion',
      lastName: 'Bajerean',
      role: Role.ADMIN,
    },
  });
  console.log(`✅ Admin user: ${admin.email}`);

  // ── Demo Partner: iHouse ──────────────────────────────────────────
  const partnerPassword = await bcrypt.hash('Partner@iHouse2024!', 12);
  const partnerUser = await prisma.user.upsert({
    where: { email: 'ihouse@pin.md' },
    update: {},
    create: {
      email: 'ihouse@pin.md',
      password: partnerPassword,
      firstName: 'Manager',
      lastName: 'iHouse',
      role: Role.PARTNER,
      partner: {
        create: {
          companyName: 'iHouse',
          commissionRate: 5.0,
          calculatorConfig: {
            allowedCreditTypes: ['ZERO', 'CLASSIC'],
            maxAmount: 30000,
          },
        },
      },
    },
  });
  console.log(`✅ Partner: ${partnerUser.email} (iHouse)`);

  // ── Demo Partner: Cactus ──────────────────────────────────────────
  const cactusPassword = await bcrypt.hash('Partner@Cactus2024!', 12);
  const cactusUser = await prisma.user.upsert({
    where: { email: 'cactus@pin.md' },
    update: {},
    create: {
      email: 'cactus@pin.md',
      password: cactusPassword,
      firstName: 'Manager',
      lastName: 'Cactus',
      role: Role.PARTNER,
      partner: {
        create: {
          companyName: 'Cactus',
          commissionRate: 4.5,
          calculatorConfig: {
            allowedCreditTypes: ['CLASSIC'],
            maxAmount: 50000,
          },
        },
      },
    },
  });
  console.log(`✅ Partner: ${cactusUser.email} (Cactus)`);

  console.log('\n🎉 Seed completed successfully!');
  console.log('\nCredentials:');
  console.log('  Admin:   admin@pin.md / Admin@Ionix2024!');
  console.log('  iHouse:  ihouse@pin.md / Partner@iHouse2024!');
  console.log('  Cactus:  cactus@pin.md / Partner@Cactus2024!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
