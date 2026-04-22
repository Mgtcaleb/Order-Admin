import './globals.css';

export const metadata = {
  title: 'US Admin Panel',
  description: 'Admin order processing dashboard'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
