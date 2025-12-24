import type { VercelRequest, VercelResponse } from "@vercel/node";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import {
  appRouter,
  createContext,
  verifyClerkJWT,
  getMembership,
  ensureUser, // Add this export to bend
} from "@ttrpg/bend";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log("[TRPC] Request:", req.method, req.url);

  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, x-campaign-id",
  );

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  try {
    // Extract auth
    const authHeader = req.headers.authorization as string | undefined;
    let claims = null;

    if (authHeader?.startsWith("Bearer ")) {
      try {
        claims = await verifyClerkJWT(authHeader.slice(7));
        console.log("[TRPC] Auth OK:", claims?.sub);

        // Sync Clerk user to database
        if (claims?.sub) {
          try {
            await ensureUser({
              id: claims.sub,
              email: claims.email,
              displayName: claims.given_name || claims.email?.split("@")[0],
              avatarUrl: claims.picture,
            });
            console.log("[TRPC] User synced to DB");
          } catch (err) {
            console.error("[TRPC] ensureUser error:", err);
          }
        }
      } catch (err) {
        console.error("[TRPC] Auth error:", err);
      }
    }

    // Extract campaign ID
    const campaignId =
      (req.headers["x-campaign-id"] as string) ||
      (req.query.campaignId as string) ||
      undefined;
    console.log("[TRPC] Campaign ID:", campaignId);

    // Create context
    console.log("[TRPC] Creating context...");
    const ctx = await createContext({
      claims,
      getMembership,
      campaignId,
      requestId: crypto.randomUUID(),
      ip:
        (req.headers["x-forwarded-for"] as string) || req.socket?.remoteAddress,
      userAgent: req.headers["user-agent"],
    });
    console.log("[TRPC] Context created");

    // Handle tRPC request
    console.log("[TRPC] Handling request...");
    const response = await fetchRequestHandler({
      endpoint: "/api/trpc",
      req: new Request(`https://${req.headers.host}${req.url}`, {
        method: req.method,
        headers: req.headers as any,
        body:
          req.method !== "GET" && req.method !== "HEAD"
            ? JSON.stringify(req.body)
            : undefined,
      }),
      router: appRouter as any,
      createContext: () => ctx,
    });

    console.log("[TRPC] Response status:", response.status);

    // Log error details
    if (response.status >= 400) {
      const errorBody = await response.clone().text();
      console.error("[TRPC] Error response:", errorBody);
    }

    // Send response
    res.status(response.status);
    response.headers.forEach((value: string, key: string) =>
      res.setHeader(key, value),
    );
    const body = await response.text();
    res.send(body);
  } catch (error) {
    console.error("[TRPC] Handler error:", error);
    res
      .status(500)
      .json({ error: "Internal server error", details: String(error) });
  }
}
