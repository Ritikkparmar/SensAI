import { redirect } from "next/navigation";
import { industries } from "@/data/industries";
import OnboardingForm from "./_components/onboarding-form";
import { getUserOnboardingStatus } from "@/actions/user";

export default async function OnboardingPage() {
  try {
    // Check if user is already onboarded
    const { isOnboarded } = await getUserOnboardingStatus();

    // Redirect to dashboard if the user is already onboarded
    if (isOnboarded) {
      redirect("/dashboard");
    }

    // Render the onboarding form if the user is not onboarded
    return (
      <main>
        <OnboardingForm industries={industries} />
      </main>
    );
  } catch (error) {
    console.error("Error fetching onboarding status:", error.message);

    // Handle errors gracefully (e.g., show an error message or redirect to an error page)
    redirect("/error");
  }
}