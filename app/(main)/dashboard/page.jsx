import { getIndustryInsights } from "@/actions/dashboard";
import DashboardView from "./_component/dashboard-view";

export default async function DashboardPage() {
  const insights = await getIndustryInsights();

  return (
    <div className="container mx-auto">
      <DashboardView insights={insights} />
    </div>
  );
}
