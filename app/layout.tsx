import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppShell } from "@/components/app-shell";
import { AuthSessionProvider } from "@/components/auth-session-provider";
import { ConfigurationProvider } from "@/components/configuration-provider";
import { ModuleProvider } from "@/components/module-provider";
import { NotificationProvider } from "@/components/notification-provider";
import { PersonalCriteriaProvider } from "@/components/personal-criteria-provider";
import { PerformanceProvider } from "@/components/performance-provider";
import { RepresentativesProvider } from "@/components/representatives-provider";
import { SessionProvider } from "@/components/session-provider";
import { WorkflowProvider } from "@/components/workflow-provider";
import { SalesDayFeatureProvider } from "@/components/salesday/feature-provider";
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
    <html lang="nl" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <AuthSessionProvider>
          <SessionProvider>
            <SalesDayFeatureProvider>
            <ModuleProvider>
              <RepresentativesProvider>
                <ConfigurationProvider>
                  <PerformanceProvider>
                    <PersonalCriteriaProvider>
                      <WorkflowProvider>
                        <NotificationProvider>
                          <AppShell>{children}</AppShell>
                        </NotificationProvider>
                      </WorkflowProvider>
                    </PersonalCriteriaProvider>
                  </PerformanceProvider>
                </ConfigurationProvider>
              </RepresentativesProvider>
            </ModuleProvider>
            </SalesDayFeatureProvider>
          </SessionProvider>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
