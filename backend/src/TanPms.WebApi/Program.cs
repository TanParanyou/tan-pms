using Microsoft.EntityFrameworkCore;
using TanPms.Application.ClientPortal;
using TanPms.Application.Common.Abstractions;
using TanPms.Application.Rack;
using TanPms.Application.Stays;
using TanPms.Infrastructure.Persistence;
using TanPms.Infrastructure.Services;
using TanPms.WebApi.ErrorHandling;
using TanPms.WebApi.Security;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentUserContext, HttpCurrentUserContext>();
builder.Services.AddScoped<AuditableEntityInterceptor>();

var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
if (!string.IsNullOrWhiteSpace(connectionString))
{
    builder.Services.AddDbContext<TanPmsDbContext>((sp, options) =>
    {
        options.UseNpgsql(connectionString);
        options.AddInterceptors(sp.GetRequiredService<AuditableEntityInterceptor>());
    });
}

var operationalService = new InMemoryOperationalService();
builder.Services.AddSingleton(operationalService);
builder.Services.AddSingleton<IPmsOperationalStore>(operationalService);
builder.Services.AddSingleton<IDocumentNumberService>(operationalService);
builder.Services.AddSingleton<IAuditLogger>(operationalService);

builder.Services.AddScoped<GetAdminRoomRackHandler>();
builder.Services.AddScoped<CheckInStayHandler>();
builder.Services.AddScoped<GetClientDashboardHandler>();

builder.Services.AddExceptionHandler<ProblemDetailsExceptionHandler>();
builder.Services.AddProblemDetails();

var app = builder.Build();

app.UseExceptionHandler();

app.MapGet("/health/live", () => Results.Ok(new { status = "Live" }));
app.MapGet("/health/ready", () => Results.Ok(new { status = "Ready" }));

var adminGroup = app.MapGroup("/api/v1/admin");

adminGroup.MapGet("/properties/{propertyId:guid}/rack", (
    Guid propertyId,
    GetAdminRoomRackHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new GetAdminRoomRackQuery(propertyId));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

adminGroup.MapPost("/stays/check-in", (
    CheckInStayRequest request,
    CheckInStayHandler handler,
    HttpContext httpContext) =>
{
    var command = new CheckInStayCommand(
        PropertyId: request.PropertyId,
        UnitId: request.UnitId,
        CustomerId: request.CustomerId,
        StayMode: request.StayMode,
        KeyDepositAmount: request.KeyDepositAmount,
        OverrideDirtyCheckIn: request.OverrideDirtyCheckIn,
        OverrideReason: request.OverrideReason);

    var result = handler.Handle(command);
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Created($"/api/v1/admin/stays/{result.Value!.Id}", result.Value);
});

var clientGroup = app.MapGroup("/api/v1/client");

clientGroup.MapGet("/dashboard", (
    GetClientDashboardHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new GetClientDashboardQuery());
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

app.Run();

public partial class Program;
