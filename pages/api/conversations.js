import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';
import { prisma } from '../../lib/prisma';
import { canManageOperations, isOrganizerStaff, isPlatformAdmin } from '../../lib/permissions';
import { writeAudit } from '../../lib/audit';

async function getAdminUser() {
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@easyevent.com').toLowerCase();
  return prisma.user.findUnique({ where: { email: adminEmail } });
}

async function hasActiveSupportTicket({ requesterId, organizerId }) {
  if (!requesterId || !organizerId) return false;
  const ticket = await prisma.ticket.findFirst({
    where: {
      requesterId: Number(requesterId),
      organizerId: Number(organizerId),
      status: 'IN_PROGRESS',
    },
    select: { id: true },
    orderBy: { updatedAt: 'desc' },
  });
  return Boolean(ticket);
}

async function findSupportConversationByClient(clientId) {
  return prisma.conversation.findFirst({
    where: {
      clientId: Number(clientId),
      client: { role: { in: ['ORGANIZER_OWNER', 'ORGANIZER_STAFF'] } },
    },
    orderBy: { updatedAt: 'desc' },
    include: {
      client: { include: { organizer: true, events: { orderBy: { date: 'desc' }, take: 1 } } },
      admin: true,
      organizer: true,
      messages: { orderBy: { createdAt: 'asc' } },
    },
  });
}

async function createSupportConversationWithFallback({ clientId, adminId, organizerId, platformAdmin }) {
  try {
    return await prisma.conversation.create({
      data: {
        clientId: Number(clientId),
        adminId: Number(adminId),
        organizerId: organizerId || null,
        staffLastReadAt: platformAdmin ? new Date() : null,
        clientLastReadAt: platformAdmin ? null : new Date(),
      },
    });
  } catch (error) {
    if (error?.code === 'P2002') {
      const existing = await prisma.conversation.findUnique({
        where: {
          clientId_adminId: {
            clientId: Number(clientId),
            adminId: Number(adminId),
          },
        },
      });

      if (existing) {
        return prisma.conversation.update({
          where: { id: existing.id },
          data: {
            updatedAt: new Date(),
            organizerId: organizerId || undefined,
            ...(platformAdmin
              ? { staffLastReadAt: new Date() }
              : { clientLastReadAt: new Date() }),
          },
        });
      }
    }

    throw error;
  }
}

function getConversationKind(conversation) {
  return conversation?.client?.role === 'CLIENT' ? 'CLIENT_SERVICE' : 'PLATFORM_SUPPORT';
}

function unreadForViewer(conversation, viewerRole) {
  const kind = getConversationKind(conversation);

  return (conversation.messages || []).filter((message) => {
    if (viewerRole === 'PLATFORM_ADMIN') {
      if (message.sender === 'PLATFORM_ADMIN') return false;
      if (!conversation.staffLastReadAt) return true;
      return message.createdAt > conversation.staffLastReadAt;
    }

    if (viewerRole === 'CLIENT') {
      if (message.sender === 'CLIENT') return false;
      if (!conversation.clientLastReadAt) return true;
      return message.createdAt > conversation.clientLastReadAt;
    }

    if (kind === 'PLATFORM_SUPPORT') {
      if (message.sender !== 'PLATFORM_ADMIN') return false;
      if (!conversation.clientLastReadAt) return true;
      return message.createdAt > conversation.clientLastReadAt;
    }

    if (message.sender !== 'CLIENT') return false;
    if (!conversation.staffLastReadAt) return true;
    return message.createdAt > conversation.staffLastReadAt;
  }).length;
}

function mapConversation(conversation, viewerRole) {
  const kind = getConversationKind(conversation);
  const unreadCount = unreadForViewer(conversation, viewerRole);
  const event = conversation.client?.events?.[0] || null;

  let contactName = 'Contact';
  let contactEmail = '';

  if (viewerRole === 'PLATFORM_ADMIN') {
    contactName = conversation.organizer?.name || conversation.client?.name || conversation.client?.email || 'Organisateur';
    contactEmail = conversation.client?.email || '';
  } else if (viewerRole === 'CLIENT') {
    contactName = conversation.organizer?.name || 'Organisateur';
    contactEmail = '';
  } else if (kind === 'PLATFORM_SUPPORT') {
    contactName = 'Support EasyEvent';
    contactEmail = conversation.admin?.email || '';
  } else {
    contactName = conversation.client?.name || conversation.client?.email || 'Client';
    contactEmail = conversation.client?.email || '';
  }

  return {
    id: conversation.id,
    type: kind,
    contactName,
    contactEmail,
    unreadCount,
    messageCount: conversation.messages?.length || 0,
    lastMessageAt: conversation.messages?.[conversation.messages.length - 1]?.createdAt || conversation.updatedAt,
    clientId: conversation.clientId,
    organizer: conversation.organizer
      ? {
          id: conversation.organizer.id,
          name: conversation.organizer.name,
          status: conversation.organizer.status,
        }
      : null,
    event: event
      ? {
          id: event.id,
          name: event.name,
          date: event.date,
          status: event.status,
          statusText: event.statusText,
        }
      : null,
    messages: conversation.messages || [],
  };
}

function mapSyntheticSupportConversation({ clientUser, organizer, admin }, viewerRole) {
  return {
    id: `support-${clientUser.id}`,
    type: 'PLATFORM_SUPPORT',
    contactName: viewerRole === 'PLATFORM_ADMIN' ? (organizer?.name || clientUser.name || clientUser.email || 'Organisateur') : 'Support EasyEvent',
    contactEmail: viewerRole === 'PLATFORM_ADMIN' ? clientUser.email || '' : admin?.email || '',
    unreadCount: 0,
    messageCount: 0,
    lastMessageAt: clientUser.createdAt,
    clientId: clientUser.id,
    organizer: organizer
      ? {
          id: organizer.id,
          name: organizer.name,
          status: organizer.status,
        }
      : null,
    event: null,
    messages: [],
  };
}

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);

  if (!session?.user?.id) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const uid = Number(session.user.id);
  const role = session.user.role;
  const isStaff = canManageOperations(session.user);
  const platformAdmin = isPlatformAdmin(session.user);
  const staffAssignedOnly = isOrganizerStaff(session.user);
  const supportMode = req.query.support === 'true' || req.body?.support === true;
  const organizerId = session.user.organizerId ? Number(session.user.organizerId) : null;

  try {
    if (req.method === 'GET') {
      if (platformAdmin) {
        const clientId = req.query.clientId ? Number(req.query.clientId) : null;
        const organizers = await prisma.organizer.findMany({
          include: {
            users: {
              where: { role: { in: ['ORGANIZER_OWNER', 'ORGANIZER_STAFF'] } },
              orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
            },
          },
          orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        });

        const convs = await prisma.conversation.findMany({
          where: {
            clientId: clientId || undefined,
            client: { role: { in: ['ORGANIZER_OWNER', 'ORGANIZER_STAFF'] } },
          },
          include: {
            client: { include: { events: { orderBy: { date: 'desc' }, take: 1 }, organizer: true } },
            admin: true,
            organizer: true,
            messages: { orderBy: { createdAt: 'asc' } },
          },
          orderBy: { updatedAt: 'desc' },
        });

        const byClientId = new Map(convs.map((item) => [item.clientId, item]));
        const rows = organizers
          .flatMap((item) => item.users.map((user) => ({ organizer: item, user })))
          .filter((item) => item.user?.id)
          .filter((item) => !clientId || item.user.id === clientId)
          .map((item) => {
            const existing = byClientId.get(item.user.id);
            if (existing) return mapConversation(existing, role);
            return mapSyntheticSupportConversation({ clientUser: item.user, organizer: item.organizer, admin: { email: session.user.email || '' } }, role);
          });

        return res.status(200).json({ convs: rows });
      }

      if (isStaff && supportMode) {
        const admin = await getAdminUser();
        if (!admin) return res.status(500).json({ message: 'Admin not found' });
        const allowed = await hasActiveSupportTicket({ requesterId: uid, organizerId });
        if (!allowed) {
          return res.status(403).json({ message: 'Support available only for tickets in progress' });
        }

        const conv = await findSupportConversationByClient(uid);

        if (!conv) {
          const organizer = organizerId ? await prisma.organizer.findUnique({ where: { id: organizerId } }) : null;
          return res.status(200).json({
            convs: [mapSyntheticSupportConversation({ clientUser: { id: uid, email: session.user.email || '', name: session.user.name || '', createdAt: new Date() }, organizer, admin }, role)],
          });
        }

        if (req.query.markRead !== 'false') {
          await prisma.conversation.update({
            where: { id: conv.id },
            data: { clientLastReadAt: new Date() },
          });
          await prisma.message.updateMany({
            where: { conversationId: conv.id, sender: 'PLATFORM_ADMIN', readAt: null },
            data: { readAt: new Date() },
          });
        }

        return res.status(200).json({ convs: [mapConversation(conv, role)] });
      }

      if (isStaff) {
        const clientId = req.query.clientId ? Number(req.query.clientId) : null;
        const markRead = req.query.markRead !== 'false';
        const where = {
          organizerId: organizerId || undefined,
          clientId: clientId || undefined,
          client: {
            role: 'CLIENT',
            ...(staffAssignedOnly
              ? {
                  events: {
                    some: {
                      organizerId,
                      assignedStaffId: uid,
                      status: { in: ['PENDING_APPROVAL', 'ACCEPTED', 'PLANNED', 'DONE'] },
                    },
                  },
                }
              : {}),
          },
        };

        const convs = await prisma.conversation.findMany({
          where,
          include: {
            client: {
              include: {
                events: {
                  where: {
                    status: { in: ['PENDING_APPROVAL', 'ACCEPTED', 'PLANNED', 'DONE'] },
                    ...(staffAssignedOnly ? { organizerId, assignedStaffId: uid } : {}),
                  },
                  orderBy: { date: 'desc' },
                  take: 1,
                },
              },
            },
            admin: true,
            organizer: true,
            messages: { orderBy: { createdAt: 'asc' } },
          },
          orderBy: { updatedAt: 'desc' },
        });

        if (clientId && markRead && convs[0]) {
          await prisma.conversation.update({
            where: { id: convs[0].id },
            data: { staffLastReadAt: new Date() },
          });
          await prisma.message.updateMany({
            where: { conversationId: convs[0].id, sender: 'CLIENT', readAt: null },
            data: { readAt: new Date() },
          });
        }

        return res.status(200).json({ convs: convs.map((item) => mapConversation(item, role)) });
      }

      const admin = await getAdminUser();
      if (!admin) {
        return res.status(500).json({ message: 'Admin not found' });
      }

      const conv = await prisma.conversation.findUnique({
        where: {
          clientId_adminId: { clientId: uid, adminId: admin.id },
        },
        include: {
          messages: { orderBy: { createdAt: 'asc' } },
          admin: true,
          organizer: true,
          client: { include: { organizer: true } },
        },
      });

      if (!conv) return res.json({ convs: [] });

      await prisma.conversation.update({
        where: { id: conv.id },
        data: { clientLastReadAt: new Date() },
      });
      await prisma.message.updateMany({
        where: { conversationId: conv.id, sender: { not: 'CLIENT' }, readAt: null },
        data: { readAt: new Date() },
      });

      return res.status(200).json({ convs: [mapConversation(conv, 'CLIENT')] });
    }

      if (req.method === 'POST') {
      const {
        text,
        clientId,
        attachmentUrl,
        attachmentName,
        attachmentType,
        linkType,
        linkId,
      } = req.body || {};

      if (!text || !String(text).trim()) {
        return res.status(400).json({ message: 'text required' });
      }

      const admin = await getAdminUser();
      if (!admin) {
        return res.status(500).json({ message: 'Admin not found' });
      }

      let effectiveClientId = uid;
      let effectiveOrganizerId = organizerId;

      if (platformAdmin) {
        effectiveClientId = Number(clientId);
        if (!effectiveClientId) {
          return res.status(400).json({ message: 'clientId required for platform admin' });
        }
        const target = await prisma.user.findUnique({ where: { id: effectiveClientId } });
        effectiveOrganizerId = target?.organizerId ? Number(target.organizerId) : null;
      } else if (isStaff && !supportMode) {
        effectiveClientId = Number(clientId);
        if (!effectiveClientId) {
          return res.status(400).json({ message: 'clientId required for organizer' });
        }
        if (staffAssignedOnly) {
          const assignedEvent = await prisma.event.findFirst({
            where: {
              ownerId: effectiveClientId,
              organizerId,
              assignedStaffId: uid,
              status: { in: ['PENDING_APPROVAL', 'ACCEPTED', 'PLANNED', 'DONE'] },
            },
            select: { id: true },
          });
          if (!assignedEvent) return res.status(403).json({ message: 'Forbidden' });
        }
      }

      let conv;

      if (platformAdmin || supportMode) {
        if (supportMode && !platformAdmin) {
          const allowed = await hasActiveSupportTicket({ requesterId: uid, organizerId: effectiveOrganizerId });
          if (!allowed) {
            return res.status(403).json({ message: 'Support available only for tickets in progress' });
          }
        }
        const existingSupportConv = await findSupportConversationByClient(effectiveClientId);
        if (existingSupportConv) {
          conv = await prisma.conversation.update({
            where: { id: existingSupportConv.id },
            data: {
              updatedAt: new Date(),
              organizerId: effectiveOrganizerId || undefined,
              ...(platformAdmin
                ? { staffLastReadAt: new Date() }
                : { clientLastReadAt: new Date() }),
            },
          });
        } else {
          conv = await createSupportConversationWithFallback({
            clientId: effectiveClientId,
            adminId: platformAdmin ? uid : admin.id,
            organizerId: effectiveOrganizerId,
            platformAdmin,
          });
        }
      } else {
        conv = await prisma.conversation.upsert({
          where: {
            clientId_adminId: { clientId: effectiveClientId, adminId: admin.id },
          },
          update: {
            updatedAt: new Date(),
            organizerId: effectiveOrganizerId || undefined,
            staffLastReadAt: new Date(),
          },
          create: {
            clientId: effectiveClientId,
            adminId: admin.id,
            organizerId: effectiveOrganizerId || null,
            staffLastReadAt: new Date(),
            clientLastReadAt: null,
          },
        });
      }

      const now = new Date().toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
      });

      const message = await prisma.message.create({
        data: {
          conversationId: conv.id,
          sender: platformAdmin ? 'PLATFORM_ADMIN' : (isStaff ? role : 'CLIENT'),
          text: String(text),
          authorId: uid,
          timestamp: now,
          attachmentUrl: attachmentUrl ? String(attachmentUrl) : null,
          attachmentName: attachmentName ? String(attachmentName) : null,
          attachmentType: attachmentType ? String(attachmentType) : null,
          linkType: linkType ? String(linkType) : null,
          linkId: linkId ? Number(linkId) : null,
        },
      });

      if (platformAdmin) {
        await prisma.notification.create({
          data: {
            userId: effectiveClientId,
            type: 'MESSAGE',
            title: 'Nouveau message de la plateforme',
            body: String(text).slice(0, 180),
            linkType: 'chat',
            linkId: conv.id,
          },
        });
      } else if (supportMode) {
        await prisma.notification.create({
          data: {
            role: 'PLATFORM_ADMIN',
            type: 'SUPPORT',
            title: 'Nouveau ticket organisateur',
            body: String(text).slice(0, 180),
            linkType: 'chat',
            linkId: conv.id,
          },
        });
      } else if (isStaff) {
        await prisma.notification.create({
          data: {
            userId: effectiveClientId,
            type: 'MESSAGE',
            title: linkType ? `Nouveau ${String(linkType).toLowerCase()} dans le chat` : 'Nouveau message',
            body: String(text).slice(0, 180),
            linkType: 'chat',
            linkId: conv.id,
          },
        });
      } else {
        await prisma.notification.create({
          data: {
            role: role || 'ORGANIZER_STAFF',
            type: 'MESSAGE',
            title: 'Nouveau message client',
            body: String(text).slice(0, 180),
            linkType: 'chat',
            linkId: conv.id,
          },
        });
      }

      await writeAudit({
        actorId: uid,
        action: supportMode ? 'SUPPORT_MESSAGE_SENT' : 'MESSAGE_SENT',
        entity: 'Conversation',
        entityId: conv.id,
        details: { clientId: effectiveClientId, organizerId: effectiveOrganizerId, attachment: Boolean(attachmentUrl) },
      });

      return res.status(201).json({ message });
    }

    if (req.method === 'PATCH') {
      const id = Number(req.body?.id);
      if (!id) return res.status(400).json({ message: 'id required' });

      const conv = await prisma.conversation.findUnique({
        where: { id },
        include: { client: { include: { events: true } } },
      });
      if (!conv) return res.status(404).json({ message: 'Conversation not found' });

      const kind = conv.client?.role === 'CLIENT' ? 'CLIENT_SERVICE' : 'PLATFORM_SUPPORT';
      if (!platformAdmin && !isStaff && conv.clientId !== uid) return res.status(403).json({ message: 'Forbidden' });
      if (staffAssignedOnly && kind === 'CLIENT_SERVICE') {
        const hasAssignedEvent = conv.client?.events?.some((event) => (
          Number(event.organizerId) === organizerId && Number(event.assignedStaffId) === uid
        ));
        if (!hasAssignedEvent) return res.status(403).json({ message: 'Forbidden' });
      }

      if (platformAdmin || (isStaff && kind === 'CLIENT_SERVICE')) {
        await prisma.conversation.update({
          where: { id },
          data: { staffLastReadAt: new Date() },
        });
        await prisma.message.updateMany({
          where: { conversationId: id, sender: platformAdmin ? { not: 'PLATFORM_ADMIN' } : 'CLIENT', readAt: null },
          data: { readAt: new Date() },
        });
      } else {
        await prisma.conversation.update({
          where: { id },
          data: { clientLastReadAt: new Date() },
        });
        await prisma.message.updateMany({
          where: {
            conversationId: id,
            sender: kind === 'PLATFORM_SUPPORT' ? 'PLATFORM_ADMIN' : { not: 'CLIENT' },
            readAt: null,
          },
          data: { readAt: new Date() },
        });
      }

      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', ['GET', 'POST', 'PATCH']);
    return res.status(405).end('Method not allowed');
  } catch (error) {
    console.error('API /conversations error:', error);
    return res.status(500).json({
      message: 'Server error',
      error: String(error?.message || error),
    });
  }
}
