import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Workflow Automation Ops Studio",
  description: "Build, test, and monitor AI-powered workflow automations with sandbox testing, step-level traces, and human approval gates."
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
