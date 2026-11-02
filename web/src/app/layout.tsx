import type { Metadata } from "next";
import { Geist, Geist_Mono, VT323 } from "next/font/google";
import { NavBar } from "@/components/NavBar";
import { Skyline } from "@/components/Skyline";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const vt323 = VT323({
  variable: "--font-vt323",
  weight: "400",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Artist Tracker",
  description: "Alerts when artists you follow announce shows near you",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${vt323.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Skyline />
        <div className="vapor-grid" aria-hidden />
        <NavBar />
        {children}
      </body>
    </html>
  );
}
