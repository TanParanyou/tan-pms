using TanPms.Application.Common.Results;

namespace TanPms.Application.Housekeeping;

public interface IHousekeepingStore
{
    Result<HousekeepingTaskListResponse> GetAdminHousekeepingTasks(Guid propertyId, string? status, Guid? buildingId);

    Result<HousekeepingTaskDto> StartAdminHousekeepingTask(Guid propertyId, Guid taskId);

    Result<HousekeepingTaskDto> CompleteAdminHousekeepingTask(Guid propertyId, Guid taskId, CompleteHousekeepingTaskRequest request);

    Result<HousekeepingTaskDto> AssignAdminHousekeepingTask(Guid propertyId, Guid taskId, AssignHousekeepingTaskRequest request);

    Result<HousekeepingTaskDto> CreateAdminHousekeepingTask(Guid propertyId, CreateHousekeepingTaskRequest request);

    Result<HousekeepingTaskDto> UpdateAdminHousekeepingTask(Guid propertyId, Guid taskId, UpdateHousekeepingTaskRequest request);

    Result<HousekeepingTaskDto> DeleteAdminHousekeepingTask(Guid propertyId, Guid taskId);
}
