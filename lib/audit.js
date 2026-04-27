import { prisma } from './prisma';

export async function writeAudit({ actorId, action, entity, entityId, details }) {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: actorId ? Number(actorId) : null,
        action,
        entity: entity || null,
        entityId: entityId != null ? String(entityId) : null,
        details: details ? JSON.stringify(details) : null,
      },
    });
  } catch (error) {
    console.error('AUDIT ERROR:', error);
  }
}
