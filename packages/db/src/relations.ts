import { defineRelations } from "drizzle-orm";

import {
  account,
  authRelations,
  gamificationRelations,
  productRelations,
  projects,
  session,
  subtasks,
  tasks,
  user,
  userDayStats,
  userMilestones,
  verification,
} from "./schema";

const tables = {
  account,
  projects,
  session,
  subtasks,
  tasks,
  user,
  userDayStats,
  userMilestones,
  verification,
};

export const relations = {
  ...defineRelations(tables),
  ...authRelations,
  ...productRelations,
  ...gamificationRelations,
  user: {
    ...authRelations.user,
    ...productRelations.user,
    ...gamificationRelations.user,
  },
};
