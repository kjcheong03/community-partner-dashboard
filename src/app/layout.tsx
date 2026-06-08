import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Community Partner Dashboard",
  description: "Responder-facing community response operations platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <body className="h-full antialiased" suppressHydrationWarning>{children}</body>
    </html>
  );
}
