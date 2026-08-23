import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { CalendarRange } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import {
  LocaleProvider,
  LocaleSwitcher,
} from "@/components/i18n/locale-provider";
import { ThemeToggle } from "@/components/ui/theme-toggle";

const geistSans = Geist({ variable: "--font-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ScheduleCraft — School Timetable Generator",
  description:
    "Automated CP-SAT powered timetable generator for the Deputy Head of Curriculum.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { ts, locale } = await getT();

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        <LocaleProvider initialLocale={locale}>
          <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur print:hidden">
            <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4">
              <Link href="/" className="flex items-center gap-2 font-semibold">
                <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
                  <CalendarRange className="h-4 w-4" />
                </span>
                ScheduleCraft
              </Link>
              <nav className="ml-4 flex items-center gap-4 text-sm text-muted-foreground">
                <Link href="/" className="hover:text-foreground">
                  {ts("nav.overview")}
                </Link>
                <Link href="/timetable" className="hover:text-foreground">
                  {ts("nav.timetable")}
                </Link>
                <Link href="/schedule" className="hover:text-foreground">
                  {ts("nav.editor")}
                </Link>
                <Link href="/admin/teachers" className="hover:text-foreground">
                  {ts("nav.admin")}
                </Link>
              </nav>
              <div className="ml-auto flex items-center gap-1">
                <ThemeToggle />
                <LocaleSwitcher />
              </div>
            </div>
          </header>
          <main className="flex-1">{children}</main>
          <Toaster richColors position="top-right" />
        </LocaleProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
