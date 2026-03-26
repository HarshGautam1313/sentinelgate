import './globals.css';
import Navbar from '../components/ui/Navbar';

export const metadata = {
  title: 'SentinelGate — AI Without the Risk',
  description: 'Sensitive data is redacted locally before reaching any AI model.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Navbar />
        {children}
      </body>
    </html>
  );
}
