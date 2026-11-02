import type { RouterClient } from "@orpc/server";

import { protectedProcedure, publicProcedure } from "../index";
import { gamificationRouter } from "./gamification";
import { preferencesRouter } from "./preferences";
import { projectsRouter } from "./projects";
import { tasksRouter } from "./tasks";

export const appRouter = {
  gamification: gamificationRouter,
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
