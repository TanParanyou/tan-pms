import { z } from "zod";

export const createHousekeepingTaskSchema = z.object({
  unitId: z.string().min(1, "Please select a unit"),
  note: z.string().trim().optional(),
  assignedStaffUserId: z.string().optional(),
});
export type CreateHousekeepingTaskFormValues = z.infer<typeof createHousekeepingTaskSchema>;

export const assignHousekeepingTaskSchema = z.object({
  assignedStaffUserId: z.string().min(1, "Please select an assignee"),
});
export type AssignHousekeepingTaskFormValues = z.infer<typeof assignHousekeepingTaskSchema>;

export const editHousekeepingNoteSchema = z.object({
  note: z.string().trim().max(500),
});
export type EditHousekeepingNoteFormValues = z.infer<typeof editHousekeepingNoteSchema>;
