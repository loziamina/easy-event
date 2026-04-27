import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { verifyCredentials } from '../../../lib/auth';

export const authOptions = {
  providers: [
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
