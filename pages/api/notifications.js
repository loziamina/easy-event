import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';
import { prisma } from '../../lib/prisma';
import { canManageOperations, isPlatformAdmin } from '../../lib/permissions';

function unreadForConversation(conversation, role) {
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

    if (req.method === 'GET') {
      const conversations = await prisma.conversation.findMany({
        where: isStaff
          ? (platformAdmin ? { client: { role: { in: ['ORGANIZER_OWNER', 'ORGANIZER_STAFF'] } } } : {})
          : { clientId: uid },
        include: { messages: true },
      });

      const unreadMessages = conversations.reduce((sum, conv) => sum + unreadForConversation(conv, session.user.role), 0);
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
