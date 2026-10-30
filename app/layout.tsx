import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { CandidateDatasetProvider } from "@/context/candidate-dataset";
import { CandidateDraftsProvider } from "@/context/candidate-drafts";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Talent Pipeline Tracker | HealthCore",
  description:
    "Manage HealthCore's recruitment pipeline: search candidates, track hiring statuses and stages, and maintain candidate details and internal interview notes.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      // Some browsers add attributes to <html> before React loads (e.g.
      // Chrome on iOS adds __gcrremoteframetoken). Only this tag's own
      // attributes are ignored, not its children.
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        {/* Public demo: academy + local candidates, loaded once for all views.
            Local saves reach the list and details through it (all routes). */}
        <CandidateDatasetProvider>
          {/* Keeps unsaved edits when switching between drawer and full page */}
          <CandidateDraftsProvider>{children}</CandidateDraftsProvider>
        </CandidateDatasetProvider>
      </body>
    </html>
  );
}
