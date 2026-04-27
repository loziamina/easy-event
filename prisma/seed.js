const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

function slugify(value) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@easyevent.com';
  const adminPasswordPlain = process.env.ADMIN_PASSWORD || 'admin123';

  const adminPassword = await bcrypt.hash(adminPasswordPlain, 10);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { role: 'PLATFORM_ADMIN' },
    create: {
      email: adminEmail,
      name: 'Admin',
      password: adminPassword,
      role: 'PLATFORM_ADMIN',
    },
  });

  const demoOrganizer = await prisma.organizer.upsert({
    where: { slug: 'easy-event-demo' },
    update: {
      name: 'Easy Event Demo',
      city: 'Paris',
      address: 'Paris',
      serviceArea: 'Ile-de-France',
      description: "Organisateur de demonstration pour tester le parcours client.",
      status: 'APPROVED',
    },
    create: {
      name: 'Easy Event Demo',
      slug: 'easy-event-demo',
      city: 'Paris',
      address: 'Paris',
      serviceArea: 'Ile-de-France',
      description: "Organisateur de demonstration pour tester le parcours client.",
      status: 'APPROVED',
    },
  });

  const ownerEmail = process.env.DEMO_ORGANIZER_EMAIL || 'owner@easyevent.com';
  const ownerPassword = await bcrypt.hash(process.env.DEMO_ORGANIZER_PASSWORD || 'owner123', 10);

  await prisma.user.upsert({
    where: { email: ownerEmail },
    update: {
      role: 'ORGANIZER_OWNER',
      organizerId: demoOrganizer.id,
    },
    create: {
      email: ownerEmail,
      name: 'Owner Demo',
      password: ownerPassword,
      role: 'ORGANIZER_OWNER',
      organizerId: demoOrganizer.id,
    },
  });

  const categories = ['Buffet', 'Decoration', 'Mobilier', 'Animation', 'Gateaux', 'Lieu'];
  for (const name of categories) {
    await prisma.category.upsert({
      where: { slug: slugify(name) },
      update: { name },
      create: { name, slug: slugify(name) },
    });
  }

  const templates = [
    {
      name: 'Naissance Basic',
      occasionType: 'Naissance',
      description: 'Ambiance douce avec buffet leger, decoration pastel et gateau.',
      theme: 'Pastel',
      guestCount: 30,
      serviceBuffet: true,
      serviceDeco: true,
      serviceGateaux: true,
      suggestedTags: 'pastel,buffet,deco,gateau',
    },
    {
      name: 'Anniversaire Essentiel',
      occasionType: 'Anniversaire',
      description: 'Decoration, gateau et animation simple pour une fete conviviale.',
      theme: 'Festif',
      guestCount: 40,
      serviceDeco: true,
      serviceGateaux: true,
      serviceAnimation: true,
      suggestedTags: 'deco,gateau,animation',
    },
    {
      name: 'Mariage Reception',
      occasionType: 'Mariage',
      description: 'Organisation, mobilier, buffet et decoration coordonnee.',
      theme: 'Elegant',
      guestCount: 120,
      serviceBuffet: true,
      serviceDeco: true,
      serviceOrganisation: true,
      serviceMobilier: true,
      suggestedTags: 'buffet,mobilier,deco,organisation',
    },
  ];

  for (const template of templates) {
    const existing = await prisma.eventTemplate.findFirst({
      where: { name: template.name, occasionType: template.occasionType },
    });

    if (!existing) {
      await prisma.eventTemplate.create({ data: template });
    }
  }

  console.log('Seed finished: admin ready ->', adminEmail);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
