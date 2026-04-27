import { prisma } from './prisma';

export const EVENT_STATUS = {
  DRAFT: 'DRAFT',
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  ACCEPTED: 'ACCEPTED',
  REFUSED: 'REFUSED',
  PLANNED: 'PLANNED',
  DONE: 'DONE',
};

export const STATUS_META = {
  [EVENT_STATUS.DRAFT]: {
    text: 'Brouillon',
    color: 'bg-gray-100 text-gray-800',
  },
  [EVENT_STATUS.PENDING_APPROVAL]: {
    text: 'En attente de validation',
    color: 'bg-yellow-100 text-yellow-800',
  },
  [EVENT_STATUS.ACCEPTED]: {
    text: 'Accepté',
    color: 'bg-green-100 text-green-800',
  },
  [EVENT_STATUS.REFUSED]: {
    text: 'Refusé',
    color: 'bg-red-100 text-red-800',
  },
  [EVENT_STATUS.PLANNED]: {
    text: 'Planifié',
    color: 'bg-blue-100 text-blue-800',
  },
  [EVENT_STATUS.DONE]: {
    text: 'Terminé',
    color: 'bg-slate-100 text-slate-800',
  },
};

const allowedTransitions = {
  [EVENT_STATUS.DRAFT]: [EVENT_STATUS.PENDING_APPROVAL],
  [EVENT_STATUS.PENDING_APPROVAL]: [EVENT_STATUS.ACCEPTED, EVENT_STATUS.REFUSED, EVENT_STATUS.DRAFT],
  [EVENT_STATUS.ACCEPTED]: [EVENT_STATUS.PLANNED, EVENT_STATUS.REFUSED],
  [EVENT_STATUS.REFUSED]: [EVENT_STATUS.PENDING_APPROVAL],
  [EVENT_STATUS.PLANNED]: [EVENT_STATUS.DONE, EVENT_STATUS.ACCEPTED],
  [EVENT_STATUS.DONE]: [],
};

export function getStatusMeta(status) {
  return STATUS_META[status] || STATUS_META[EVENT_STATUS.DRAFT];
}

export function canTransition(fromStatus, toStatus) {
  return allowedTransitions[fromStatus]?.includes(toStatus) || false;
}

export function dailyEventCapacity() {
  const value = Number(process.env.DAILY_EVENT_CAPACITY || 3);
  return Number.isFinite(value) && value > 0 ? value : 3;
}

export function dayRange(date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

export async function countActiveEventsForDay(date, excludeEventId, organizerId) {
  const { start, end } = dayRange(date);
  return prisma.event.count({
    where: {
      id: excludeEventId ? { not: Number(excludeEventId) } : undefined,
      organizerId: organizerId ? Number(organizerId) : undefined,
      date: { gte: start, lt: end },
      status: { in: [EVENT_STATUS.PENDING_APPROVAL, EVENT_STATUS.ACCEPTED, EVENT_STATUS.PLANNED] },
    },
  });
}

export async function writeEventHistory({ eventId, actorId, action, fromStatus, toStatus, details }) {
  await prisma.eventHistory.create({
    data: {
      eventId: Number(eventId),
      actorId: actorId ? Number(actorId) : null,
      action,
      fromStatus: fromStatus || null,
      toStatus: toStatus || null,
      details: details ? JSON.stringify(details) : null,
    },
  });
}
