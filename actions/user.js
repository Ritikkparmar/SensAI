"use server";

import { db } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { generateAIInsights } from "./dashboard";

export async function updateUser(data) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
  });

  if (!user) throw new Error("User not found");

  try {
    // Start a transaction to handle both user update and industry insights creation
    const result = await db.$transaction(async (tx) => {
      // Check if industry insights already exist
      let industryInsight = await tx.industryInsight.findUnique({
        where: {
          industry: data.industry,
        },
      });

      // If industry insights don't exist, generate and create them
      if (!industryInsight) {
        const insights = await generateAIInsights(data.industry);

        industryInsight = await tx.industryInsight.create({
          data: {
            industry: data.industry,
            ...insights,
            nextUpdate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week from now
          },
        });
      }

      // Update the user profile
      const updatedUser = await tx.user.update({
        where: { clerkUserId: userId },
        data: {
          industry: data.industry,
          experience: data.experience,
          bio: data.bio,
          skills: data.skills.split(",").map((skill) => skill.trim()), // Split and trim skills
        },
      });

      return { updatedUser, industryInsight };
    });

    // Revalidate the cache for the dashboard or other relevant pages
    revalidatePath("/dashboard");

    console.log("User and industry insights updated successfully:", result);
    return { success: true };
  } catch (error) {
    console.error("Error updating user and industry:", error.message);
    return { success: false, error: error.message };
  }
}

export async function getUserOnboardingStatus() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  try {
    const user = await db.user.findUnique({
      where: {
        clerkUserId: userId,
      },
      select: {
        industry: true,
      },
    });

    if (!user) throw new Error("User not found");

    return {
      isOnboarded: !!user.industry, // Check if the industry field is set
    };
  } catch (error) {
    console.error("Error checking onboarding status:", error.message);
    throw new Error("Failed to check onboarding status");
  }
}