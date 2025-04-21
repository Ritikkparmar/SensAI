"use server";

import { db } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { checkUser } from "@/lib/checkUser";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

export const generateAIInsights = async (industry) => {
  const prompt = `
          Analyze the current state of the ${industry} industry and provide insights in ONLY the following JSON format without any additional notes or explanations:
          {
            "salaryRanges": [
              { "role": "string", "min": number, "max": number, "median": number, "location": "string" }
            ],
            "growthRate": number,
            "demandLevel": "High" | "Medium" | "Low",
            "topSkills": ["skill1", "skill2"],
            "marketOutlook": "Positive" | "Neutral" | "Negative",
            "keyTrends": ["trend1", "trend2"],
            "recommendedSkills": ["skill1", "skill2"]
          }
          
          IMPORTANT: Return ONLY the JSON. No additional text, notes, or markdown formatting.
          Include at least 5 common roles for salary ranges.
          Growth rate should be a percentage.
          Include at least 5 skills and trends.
        `;

  try {
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();
    const cleanedText = text.replace(/```(?:json)?\n?/g, "").trim();

    // Parse the JSON response
    return JSON.parse(cleanedText);
  } catch (error) {
    console.error("Error generating AI insights:", error);
    throw new Error("Failed to generate industry insights");
  }
};

export async function getIndustryInsights() {
  try {
    const { userId, emailAddress } = await auth();
    console.log("Auth result:", { userId, emailAddress });
    
    if (!userId || !emailAddress) {
      console.error("User is not authenticated or missing email.");
      throw new Error("Unauthorized");
    }
    // Fetch the user and their industry insights
    let user = await db.user.findUnique({
      where: { clerkUserId: userId },
      include: { industryInsight: true },
    });

    if (!user) {
      console.log("User not found in the database. Creating a new user...");
      const newUser = await db.user.create({
        data: {
          clerkUserId: userId,
          email: emailAddress, // Ensure email is passed
          industry: null, // Default value indicating not onboarded
        },
      });
      console.log("New user created:", newUser);
      user = newUser;
    }

    // Check if the user is new (e.g., industry is not defined)
    if (!user.industry) {
      console.log("User industry is not defined. Redirecting to onboarding...");
      return {
        success: false,
        message: "User industry is not defined. Please complete your profile.",
        redirectToOnboarding: true,
      };
    }

    // If no industry insights exist, generate them
    if (!user.industryInsight) {
      console.log("Generating new industry insights for user...");
      const insights = await generateAIInsights(user.industry);

      const industryInsight = await db.industryInsight.create({
        data: {
          industry: user.industry,
          ...insights,
          nextUpdate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week from now
        },
      });

      console.log("New industry insights created:", industryInsight);
      return {
        success: true,
        data: industryInsight,
      };
    }

    // Return existing industry insights
    console.log("Returning existing industry insights for user...");
    return {
      success: true,
      data: user.industryInsight,
    };
  } catch (error) {
    console.error("Error in getIndustryInsights:", error);
    return {
      success: false,
      message: "Failed to fetch industry insights",
    };
  }
}