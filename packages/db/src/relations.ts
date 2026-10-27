import { defineRelations } from "drizzle-orm";

import {
  account,
  authRelations,
  productRelations,
  projects,
  session,
  subtasks,
  tasks,
  user,
  verification,
} from "./schema";

const tables = {
  account,
  projects,
  session,
  subtasks,
  tasks,
  user,
  verification,
};

export const relations = {
  ...defineRelations(tables),
  ...authRelations,
  ...productRelations,
  user: {
    ...authRelations.user,
    ...productRelations.user,
  },
};
