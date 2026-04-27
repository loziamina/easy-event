import { prisma } from './prisma';

export async function notifyUser({ userId, type, title, body }) {
  if (!userId) return null;
  return prisma.notification.create({
    data: {
      userId: Number(userId),
      type,
      title,
      body: body ? String(body).slice(0, 220) : null,
    },
  });
}

export async function notifyRole({ role, type, title, body }) {
  if (!role) return null;
  return prisma.notification.create({
    data: {
      role,
      type,
      title,
      body: body ? String(body).slice(0, 220) : null,
    },
  });
}

export async function notifyOrganizerUsers({ organizerId, type, title, body, excludeUserId }) {
  if (!organizerId) return [];
  const users = await prisma.user.findMany({
    where: {
      organizerId: Number(organizerId),
      role: { in: ['ORGANIZER_OWNER', 'ORGANIZER_STAFF'] },
      id: excludeUserId ? { not: Number(excludeUserId) } : undefined,
    },
    select: { id: true },
  });

  if (users.length === 0) return [];

  return prisma.notification.createMany({
    data: users.map((user) => ({
      userId: user.id,
      type,
      title,
      body: body ? String(body).slice(0, 220) : null,
    })),
  });
}
