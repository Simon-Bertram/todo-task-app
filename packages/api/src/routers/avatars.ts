import { ORPCError } from "@orpc/server";
import type { Database } from "@todo-task-app/db";
import { rateLimit, user } from "@todo-task-app/db/schema/auth";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure } from "../index";
import {
  buildAvatarPrompt,
  isAllowedGalleryPath,
  isOwnedAvatarKey,
  pickRandomAvatarPrompt,
} from "../lib/avatars";

const GENERATE_WINDOW_MS = 60_000;
const GENERATE_MAX_PER_WINDOW = 5;
const FLUX_MODEL = "black-forest-labs/FLUX.1-schnell";

const generateInputSchema = z.object({
  mode: z.enum(["prompt", "random"]),
  prompt: z.string().trim().min(1).max(240).optional(),
});

const generateOutputSchema = z.object({
  key: z.string(),
  previewUrl: z.string(),
  promptUsed: z.string(),
});

const commitInputSchema = z.discriminatedUnion("source", [
  z.object({
    path: z.string(),
    source: z.literal("gallery"),
  }),
  z.object({
    key: z.string(),
    source: z.literal("generated"),
  }),
]);

const commitOutputSchema = z.object({
  image: z.string(),
});

async function enforceGenerateRateLimit(
  db: Database,
  userId: string
): Promise<void> {
  const key = `avatar-generate:${userId}`;
  const now = Date.now();
  const rows = await db
    .select()
    .from(rateLimit)
    .where(eq(rateLimit.key, key))
    .limit(1);
  const [row] = rows;

  if (!row) {
    await db.insert(rateLimit).values({
      count: 1,
      id: crypto.randomUUID(),
      key,
      lastRequest: now,
    });
    return;
  }

  const withinWindow = now - row.lastRequest < GENERATE_WINDOW_MS;
  if (withinWindow && row.count >= GENERATE_MAX_PER_WINDOW) {
    throw new ORPCError("TOO_MANY_REQUESTS", {
      message: "Avatar generation rate limit exceeded. Try again shortly.",
    });
  }

  await db
    .update(rateLimit)
    .set({
      count: withinWindow ? row.count + 1 : 1,
      lastRequest: now,
    })
    .where(eq(rateLimit.key, key));
}

const TRAILING_SLASH = /\/$/;

function mediaUrl(assetBaseUrl: string, key: string): string {
  const base = assetBaseUrl.replace(TRAILING_SLASH, "");
  return `${base}/media/avatars/${key}`;
}

export const avatarsRouter = {
  commit: protectedProcedure
    .input(commitInputSchema)
    .output(commitOutputSchema)
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;
      let image: string;

      if (input.source === "gallery") {
        if (!isAllowedGalleryPath(input.path)) {
          throw new ORPCError("BAD_REQUEST", {
            message: "Invalid gallery avatar path.",
          });
        }
        image = input.path;
      } else {
        if (!isOwnedAvatarKey(userId, input.key)) {
          throw new ORPCError("BAD_REQUEST", {
            message: "Invalid generated avatar key.",
          });
        }
        const object = await context.avatars.get(input.key);
        if (!object) {
          throw new ORPCError("NOT_FOUND", {
            message: "Generated avatar not found. Generate again.",
          });
        }
        image = mediaUrl(context.assetBaseUrl, input.key);
      }

      await context.db.update(user).set({ image }).where(eq(user.id, userId));

      return { image };
    }),

  generate: protectedProcedure
    .input(generateInputSchema)
    .output(generateOutputSchema)
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;

      if (!context.hfToken) {
        throw new ORPCError("INTERNAL_SERVER_ERROR", {
          message: "Avatar generation is not configured (missing HF_TOKEN).",
        });
      }

      if (input.mode === "prompt" && !input.prompt?.trim()) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Prompt is required for describe mode.",
        });
      }

      await enforceGenerateRateLimit(context.db, userId);

      const idea =
        input.mode === "random"
          ? pickRandomAvatarPrompt()
          : (input.prompt ?? "").trim();
      const promptUsed = buildAvatarPrompt(idea);

      const { InferenceClient } = await import("@huggingface/inference");
      const client = new InferenceClient(context.hfToken);

      let bytes: ArrayBuffer;
      try {
        const blob = await client.textToImage(
          {
            inputs: promptUsed,
            model: FLUX_MODEL,
            parameters: {
              height: 512,
              num_inference_steps: 4,
              width: 512,
            },
            provider: "auto",
          },
          { outputType: "blob" }
        );
        bytes = await blob.arrayBuffer();
      } catch (error) {
        throw new ORPCError("INTERNAL_SERVER_ERROR", {
          cause: error,
          message: "Could not generate avatar. Try again.",
        });
      }

      const key = `${userId}/${crypto.randomUUID()}.png`;
      await context.avatars.put(key, bytes, {
        httpMetadata: { contentType: "image/png" },
      });

      return {
        key,
        previewUrl: mediaUrl(context.assetBaseUrl, key),
        promptUsed: idea,
      };
    }),
};
