import { Suspense } from "react";
import { MainAppShell } from "../../components/layout/MainAppShell";
import DashboardPageContent from "../../components/dashboard/AnalyticsPageContent";

export default function DashboardPage() {
  return (
    <MainAppShell>
      <Suspense fallback={<div style={{ padding: "1rem" }}>Lade Dashboard...</div>}>
        <DashboardPageContent />
      </Suspense>
    </MainAppShell>
  );
}
