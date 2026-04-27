import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';
import { prisma } from '../../lib/prisma';
import { isOrganizerUser } from '../../lib/permissions';
import { writeAudit } from '../../lib/audit';

function unreadForUser(conversation, userId) {
  const isClientSide = conversation.clientId === userId;
  const lastReadAt = isClientSide ? conversation.clientLastReadAt : conversation.staffLastReadAt;

  return (conversation.messages || []).filter((message) => {
    if (message.authorId === userId) return false;
    if (!lastReadAt) return true;
    return message.createdAt > lastReadAt;
  }).length;
}

function mapConversation(conversation, meId) {
  const teammate = conversation.clientId === meId ? conversation.admin : conversation.client;
  const lastMessage = conversation.messages?.[conversation.messages.length - 1] || null;

  return {
    id: conversation.id,
    type: 'TEAM',
    clientId: teammate.id,
    contactName: teammate.name || teammate.email || 'Membre equipe',
    contactEmail: teammate.email || '',
    unreadCount: unreadForUser(conversation, meId),
    messageCount: conversation.messages?.length || 0,
    lastMessageAt: lastMessage?.createdAt || conversation.updatedAt,
    organizer: conversation.organizer
      ? {
          id: conversation.organizer.id,
          name: conversation.organizer.name,
          status: conversation.organizer.status,
        }
      : null,
    teammate: {
      id: teammate.id,
      role: teammate.role,
      name: teammate.name,
      email: teammate.email,
    },
    messages: conversation.messages || [],
  };
}

function mapSyntheticConversation(teammate, organizer) {
  return {
    id: `team-${teammate.id}`,
    type: 'TEAM',
    clientId: teammate.id,
    contactName: teammate.name || teammate.email || 'Membre equipe',
    contactEmail: teammate.email || '',
    unreadCount: 0,
    messageCount: 0,
    lastMessageAt: teammate.createdAt,
    organizer: organizer
      ? {
          id: organizer.id,
          name: organizer.name,
          status: organizer.status,
        }
      : null,
    teammate: {
      id: teammate.id,
      role: teammate.role,
      name: teammate.name,
      email: teammate.email,
    },
    messages: [],
  };
}

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) return res.status(401).json({ message: 'Unauthorized' });
  if (!isOrganizerUser(session.user)) return res.status(403).json({ message: 'Forbidden' });

  const uid = Number(session.user.id);
  const organizerId = session.user.organizerId ? Number(session.user.organizerId) : null;
  if (!organizerId) return res.status(400).json({ message: 'Organizer required' });

  try {
    if (req.method === 'GET') {
      const targetUserId = req.query.clientId ? Number(req.query.clientId) : null;
      const teammates = await prisma.user.findMany({
        where: {
          organizerId,
          role: { in: ['ORGANIZER_OWNER', 'ORGANIZER_STAFF'] },
          NOT: { id: uid },
        },
        orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
      });

      const teammateIds = teammates.map((item) => item.id);
      const organizer = await prisma.organizer.findUnique({ where: { id: organizerId } });
      const convs = await prisma.conversation.findMany({
        where: {
          organizerId,
          OR: [
            { clientId: uid, adminId: { in: teammateIds } },
            { adminId: uid, clientId: { in: teammateIds } },
          ],
        },
        include: {
          client: true,
          admin: true,
          organizer: true,
          messages: { orderBy: { createdAt: 'asc' } },
        },
        orderBy: { updatedAt: 'desc' },
      });

      const byTeammate = new Map();
      convs.forEach((conv) => {
        const teammateId = conv.clientId === uid ? conv.adminId : conv.clientId;
        byTeammate.set(teammateId, conv);
      });

      const rows = teammates
        .filter((teammate) => !targetUserId || teammate.id === targetUserId)
        .map((teammate) => {
          const existing = byTeammate.get(teammate.id);
          return existing ? mapConversation(existing, uid) : mapSyntheticConversation(teammate, organizer);
        });

      return res.status(200).json({ convs: rows });
    }

    if (req.method === 'POST') {
      const { targetUserId, text, attachmentUrl, attachmentName, attachmentType } = req.body || {};
      const teammateId = Number(targetUserId);
      if (!teammateId || !String(text || '').trim()) {
        return res.status(400).json({ message: 'targetUserId and text required' });
      }

      const teammate = await prisma.user.findFirst({
        where: {
          id: teammateId,
          organizerId,
          role: { in: ['ORGANIZER_OWNER', 'ORGANIZER_STAFF'] },
        },
      });
      if (!teammate) return res.status(404).json({ message: 'Teammate not found' });

      const pairClientId = Math.min(uid, teammateId);
      const pairAdminId = Math.max(uid, teammateId);
      const iAmClientSide = pairClientId === uid;

      const conv = await prisma.conversation.upsert({
        where: {
          clientId_adminId: { clientId: pairClientId, adminId: pairAdminId },
        },
        update: {
          updatedAt: new Date(),
          organizerId,
          ...(iAmClientSide ? { clientLastReadAt: new Date() } : { staffLastReadAt: new Date() }),
        },
        create: {
          clientId: pairClientId,
          adminId: pairAdminId,
          organizerId,
          clientLastReadAt: iAmClientSide ? new Date() : null,
          staffLastReadAt: iAmClientSide ? null : new Date(),
        },
      });

      const now = new Date().toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
      });

      const message = await prisma.message.create({
        data: {
          conversationId: conv.id,
          sender: 'TEAM',
          text: String(text),
          authorId: uid,
          timestamp: now,
          attachmentUrl: attachmentUrl ? String(attachmentUrl) : null,
          attachmentName: attachmentName ? String(attachmentName) : null,
          attachmentType: attachmentType ? String(attachmentType) : null,
        },
      });

      await prisma.notification.create({
        data: {
          userId: teammateId,
          type: 'TEAM_MESSAGE',
          title: 'Nouveau message equipe',
          body: String(text).slice(0, 180),
        },
      });

      await writeAudit({
        actorId: uid,
        action: 'TEAM_MESSAGE_SENT',
        entity: 'Conversation',
        entityId: conv.id,
        details: { teammateId },
      });

      return res.status(201).json({ message });
    }

    if (req.method === 'PATCH') {
      const id = Number(req.body?.id);
      if (!id) return res.status(400).json({ message: 'id required' });

      const conv = await prisma.conversation.findUnique({ where: { id } });
      if (!conv) return res.status(404).json({ message: 'Conversation not found' });
      if (![conv.clientId, conv.adminId].includes(uid)) return res.status(403).json({ message: 'Forbidden' });

      const iAmClientSide = conv.clientId === uid;
      await prisma.conversation.update({
        where: { id },
        data: iAmClientSide ? { clientLastReadAt: new Date() } : { staffLastReadAt: new Date() },
      });
      await prisma.message.updateMany({
        where: { conversationId: id, authorId: { not: uid }, readAt: null },
        data: { readAt: new Date() },
      });

      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', ['GET', 'POST', 'PATCH']);
    return res.status(405).end('Method not allowed');
  } catch (error) {
    console.error('API /team-conversations error:', error);
    return res.status(500).json({ message: 'Server error', error: String(error?.message || error) });
  }
}
