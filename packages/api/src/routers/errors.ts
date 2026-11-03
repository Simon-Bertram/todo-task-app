import { z } from "zod";

import { protectedProcedure } from "../index";
import {
  logStructuredError,
  resolveRequestId,
  truncateForReport,
} from "../lib/app-error";

const reportInputSchema = z.object({
  code: z.string().trim().max(128).optional(),
  message: z.string().trim().min(1).max(2000),
  path: z.string().trim().max(256).optional(),
  requestId: z.string().trim().max(128).optional(),
  source: z.enum(["island", "window", "ssr-bridge"]),
  stack: z.string().trim().max(8000).optional(),
  url: z.string().trim().max(2048).optional(),
});

export const errorsRouter = {
  report: protectedProcedure
    .input(reportInputSchema)
    .output(z.object({ ok: z.literal(true), requestId: z.string() }))
    .handler(({ context, input }) => {
      const requestId = resolveRequestId(input.requestId, context.requestId);
      logStructuredError("client.error.report", {
        code: input.code ?? null,
        message: input.message,
        path: input.path ?? null,
        requestId,
        source: input.source,
        stack: truncateForReport(input.stack) ?? null,
        url: input.url ?? null,
        userId: context.session.user.id,
      });
      return { ok: true as const, requestId };
    }),
};

export { reportInputSchema };
