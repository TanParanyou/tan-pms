namespace TanPms.Application.Housekeeping;

public sealed record CompleteHousekeepingTaskRequest(
    bool SkipInspection = false);
