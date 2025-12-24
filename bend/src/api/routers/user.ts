import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import * as users from "../../db/queries/users";

// ============================================
// USER ROUTER
// ============================================
//
// User profile and onboarding endpoints.
//

export const userRouter = router({
  // ==========================================
  // QUERIES
  // ==========================================

  /**
   * Get current user profile
   */
  me: protectedProcedure.query(async ({ ctx }) => {
    const user = await users.getUserByClerkId(ctx.auth.userId);
    return user;
  }),

  /**
   * Check if onboarding is complete
   */
  needsOnboarding: protectedProcedure.query(async ({ ctx }) => {
    return users.needsOnboarding(ctx.auth.userId);
  }),

  // ==========================================
  // MUTATIONS
  // ==========================================

  /**
   * Complete onboarding
   */
  completeOnboarding: protectedProcedure
    .input(
      z.object({
        displayName: z.string().min(2).max(50),
        role: z.enum(["player", "gm", "both"]),
        pronouns: z.string().max(30).optional(),
        timezone: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      console.log("[completeOnboarding] Starting with input:", JSON.stringify(input));
      console.log("[completeOnboarding] User ID:", ctx.auth.userId);
      try {
        const user = await users.updateUser(ctx.auth.userId, {
          displayName: input.displayName,
          preferredRole: input.role,
          pronouns: input.pronouns,
          timezone: input.timezone,
          onboardingComplete: true,
        });
        console.log("[completeOnboarding] Success:", JSON.stringify(user));
        return user;
      } catch (err) {
        console.error("[completeOnboarding] Error:", err);
        throw err;
      }
    }),

  /**
   * Update profile
   */
  updateProfile: protectedProcedure
    .input(
      z.object({
        displayName: z.string().min(2).max(50).optional(),
        pronouns: z.string().max(30).optional(),
        timezone: z.string().optional(),
        preferredRole: z.enum(["player", "gm", "both"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = await users.updateUser(ctx.auth.userId, input);
      return user;
    }),
});
