import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';
import { prisma } from '../../lib/prisma';
import { canManageOperations, isOrganizerOwner, isOrganizerStaff, isPlatformAdmin } from '../../lib/permissions';

function isTeamConversation(conversation) {
  return ['ORGANIZER_OWNER', 'ORGANIZER_STAFF'].includes(conversation.client?.role) &&
    ['ORGANIZER_OWNER', 'ORGANIZER_STAFF'].includes(conversation.admin?.role);
}

function isSupportConversation(conversation) {
  return ['ORGANIZER_OWNER', 'ORGANIZER_STAFF'].includes(conversation.client?.role) &&
    conversation.admin?.role === 'PLATFORM_ADMIN';
}

function unreadForConversation(conversation, user) {
  const role = user.role;
  const uid = Number(user.id);

  if (isTeamConversation(conversation)) {
    const lastReadAt = conversation.clientId === uid ? conversation.clientLastReadAt : conversation.staffLastReadAt;
    return (conversation.messages || []).filter((message) => {
      if (message.authorId === uid) return false;
      if (!lastReadAt) return true;
      return message.createdAt > lastReadAt;
    }).length;
  }

  if (isSupportConversation(conversation) && role !== 'PLATFORM_ADMIN') {
    return (conversation.messages || []).filter((message) => {
      if (message.sender !== 'PLATFORM_ADMIN') return false;
      if (!conversation.clientLastReadAt) return true;
      return message.createdAt > conversation.clientLastReadAt;
    }).length;
  }

  return (conversation.messages || []).filter((message) => {
    if (role === 'PLATFORM_ADMIN') {
      if (message.sender === 'PLATFORM_ADMIN') return false;
      if (!conversation.staffLastReadAt) return true;
      return message.createdAt > conversation.staffLastReadAt;
    }

    if (role !== 'CLIENT') {
      if (message.sender !== 'CLIENT') return false;
      if (!conversation.staffLastReadAt) return true;
      return message.createdAt > conversation.staffLastReadAt;
    }
    if (message.sender === 'CLIENT') return false;
    if (!conversation.clientLastReadAt) return true;
    return message.createdAt > conversation.clientLastReadAt;
  }).length;
}

export default async function handler(req, res) {
  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.id) return res.status(401).json({ message: 'Unauthorized' });

    const uid = Number(session.user.id);
    const isStaff = canManageOperations(session.user);
    const platformAdmin = isPlatformAdmin(session.user);
    const organizerStaff = isOrganizerStaff(session.user);
    const organizerOwner = isOrganizerOwner(session.user);
    const organizerId = session.user.organizerId ? Number(session.user.organizerId) : null;

    if (req.method === 'GET') {
      const clientServiceEventScope = organizerStaff
        ? { organizerId, assignedStaffId: uid }
        : organizerOwner
          ? { organizerId, assignedStaffId: null }
          : { organizerId };

      const conversations = await prisma.conversation.findMany({
        where: platformAdmin
          ? { client: { role: { in: ['ORGANIZER_OWNER', 'ORGANIZER_STAFF'] } } }
          : isStaff
            ? {
                OR: [
                  {
                    clientId: uid,
                    admin: { role: 'PLATFORM_ADMIN' },
                  },
                  {
                    organizerId,
                    OR: [{ clientId: uid }, { adminId: uid }],
                    client: { role: { in: ['ORGANIZER_OWNER', 'ORGANIZER_STAFF'] } },
                    admin: { role: { in: ['ORGANIZER_OWNER', 'ORGANIZER_STAFF'] } },
                  },
                  {
                    organizerId,
                    client: {
                      role: 'CLIENT',
                      events: {
                        some: {
                          ...clientServiceEventScope,
                          status: { in: ['PENDING_APPROVAL', 'ACCEPTED', 'PLANNED', 'DONE'] },
                        },
                      },
                    },
                  },
                ],
              }
            : { clientId: uid },
        include: { client: { include: { events: true } }, admin: true, messages: true },
      });

      const unreadMessages = conversations.reduce((sum, conv) => sum + unreadForConversation(conv, session.user), 0);
      const notifications = await prisma.notification.findMany({
        where: {
          isRead: false,
          OR: [
            { userId: uid },
            ...(isStaff ? [{ role: session.user.role }] : []),
          ],
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      });

      return res.status(200).json({
        unreadMessages,
        unreadNotifications: notifications.length,
        notifications,
      });
    }

    if (req.method === 'PATCH') {
      const notificationId = Number(req.body?.id);
      if (notificationId) {
        await prisma.notification.updateMany({
          where: {
            id: notificationId,
            OR: [
              { userId: uid },
              ...(isStaff ? [{ role: session.user.role }] : []),
            ],
          },
          data: { isRead: true },
        });
        return res.status(200).json({ ok: true });
      }

      await prisma.notification.updateMany({
        where: {
          isRead: false,
          OR: [
            { userId: uid },
            ...(isStaff ? [{ role: session.user.role }] : []),
          ],
        },
        data: { isRead: true },
      });
      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', ['GET', 'PATCH']);
    return res.status(405).end('Method not allowed');
  } catch (error) {
    console.error('API /notifications error:', error);
    return res.status(500).json({ message: 'Server error', error: String(error?.message || error) });
  }
}
