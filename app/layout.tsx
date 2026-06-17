import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppShell } from "@/components/app-shell";
import { ModuleProvider } from "@/components/module-provider";
import { PersonalCriteriaProvider } from "@/components/personal-criteria-provider";
import { SessionProvider } from "@/components/session-provider";
import { WorkflowProvider } from "@/components/workflow-provider";
import { branding } from "@/config/branding";

export const metadata: Metadata = {
  title: {
    default: branding.appName,
    template: `%s | ${branding.appName}`,
  },
  description: branding.description,
  manifest: "/manifest.webmanifest",
  applicationName: branding.fullAppName,
  icons: {
    icon: branding.logoMarkPath,
    apple: branding.logoMarkPath,
  },
};

export const viewport: Viewport = {
  themeColor: branding.primaryColor,
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="nl">
      <body>
        <SessionProvider>
          <ModuleProvider>
            <PersonalCriteriaProvider>
              <WorkflowProvider>
                <AppShell>{children}</AppShell>
              </WorkflowProvider>
            </PersonalCriteriaProvider>
          </ModuleProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
