import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { SkinProfileProvider } from "@/context/SkinProfileContext";
import SidePanel from "@/components/SidePanel";
import SiteHeader from "@/components/SiteHeader";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SKINdex",
  description: "Scan skincare products for ingredients that could irritate your skin.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en" className={`${geist.variable} h-full antialiased`}>
        <body className="min-h-full flex flex-col bg-white text-gray-900">
          <SkinProfileProvider>
            <SiteHeader />
            <SidePanel />
            <div className="flex-1">{children}</div>
          </SkinProfileProvider>
          <footer className="border-t border-gray-100 px-6 py-4 mt-8">
            <p className="text-xs text-gray-400 text-center">
              SKINdex is for informational purposes only. Always consult a dermatologist before making changes to your skincare routine.{" "}
              <a href="/disclaimer" className="underline underline-offset-2 hover:text-gray-600">Disclaimer</a>
            </p>
          </footer>
        </body>
      </html>
    </ClerkProvider>
  );
}
