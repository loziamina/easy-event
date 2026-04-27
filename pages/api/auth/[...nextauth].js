import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import { verifyCredentials } from '../../../lib/auth';
import { prisma } from '../../../lib/prisma';
import { ROLES } from '../../../lib/permissions';

function mapSessionUser(user) {
  return {
    id: String(user.id),
    email: user.email,
    name: user.name || '',
    avatarUrl: user.avatarUrl || '',
    phone: user.phone || '',
    address: user.address || '',
    role: user.role,
    organizerId: user.organizerId ? String(user.organizerId) : null,
    organizerName: user.organizer?.name || '',
    organizerStatus: user.organizer?.status || '',
  };
}

export const authOptions = {
  providers: [
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Mot de passe', type: 'password' },
      },
      async authorize(credentials) {
        try {
          if (!credentials?.email || !credentials?.password) return null;

          const user = await verifyCredentials(
            credentials.email,
            credentials.password
          );

          if (!user) return null;
          return user;
        } catch (error) {
          console.error('NEXTAUTH AUTHORIZE ERROR:', error);
          return null;
        }
      },
    }),
  ],

  session: {
    strategy: 'jwt',
  },

  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider !== 'google') return true;

      const normalizedEmail = String(user?.email || '').trim().toLowerCase();
      if (!normalizedEmail) return false;

      const existing = await prisma.user.findUnique({
        where: { email: normalizedEmail },
        include: { organizer: true },
      });

      if (existing) {
        const updated = await prisma.user.update({
          where: { id: existing.id },
          data: {
            name: existing.name || user.name || null,
            avatarUrl: user.image || existing.avatarUrl || null,
          },
          include: { organizer: true },
        });
        Object.assign(user, mapSessionUser(updated));
        return true;
      }

      if (normalizedEmail === (process.env.ADMIN_EMAIL || 'admin@easyevent.com').toLowerCase()) {
        return false;
      }

      const created = await prisma.user.create({
        data: {
          email: normalizedEmail,
          name: user.name || null,
          avatarUrl: user.image || null,
          password: null,
          role: ROLES.CLIENT,
        },
        include: { organizer: true },
      });

      Object.assign(user, mapSessionUser(created));
      return true;
    },

    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.email = user.email;
        token.name = user.name;
        token.avatarUrl = user.avatarUrl;
        token.phone = user.phone;
        token.address = user.address;
        token.organizerId = user.organizerId;
        token.organizerName = user.organizerName;
        token.organizerStatus = user.organizerStatus;
      }
      return token;
    },

    async session({ session, token }) {
      session.user = {
        ...session.user,
        id: token.id,
        role: token.role,
        email: token.email,
        name: token.name,
        avatarUrl: token.avatarUrl,
        phone: token.phone,
        address: token.address,
        organizerId: token.organizerId,
        organizerName: token.organizerName,
        organizerStatus: token.organizerStatus,
      };
      return session;
    },
  },

  pages: {
    signIn: '/auth/signin',
  },

  secret: process.env.NEXTAUTH_SECRET,
};

export default NextAuth(authOptions);
