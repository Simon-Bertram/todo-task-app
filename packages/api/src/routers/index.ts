import type { RouterClient } from "@orpc/server";

import { protectedProcedure, publicProcedure } from "../index";
import { preferencesRouter } from "./preferences";
import { projectsRouter } from "./projects";
import { tasksRouter } from "./tasks";

export const appRouter = {
  healthCheck: publicProcedure.handler(() => "OK"),
  preferences: preferencesRouter,
  privateData: protectedProcedure.handler(({ context }) => ({
    message: "This is private",
    user: context.session?.user,
  })),
  projects: projectsRouter,
  tasks: tasksRouter,
};
export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
