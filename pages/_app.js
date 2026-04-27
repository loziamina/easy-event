import '../styles/globals.css';
import { SessionProvider } from 'next-auth/react';
import { ToastProvider } from '../components/ToastProvider';

export default function App({ Component, pageProps }) {
  return (
    <SessionProvider session={pageProps.session}>
      <ToastProvider>
        <Component {...pageProps} />
      </ToastProvider>
    </SessionProvider>
  );
}
