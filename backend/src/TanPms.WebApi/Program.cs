using TanPms.Application.Abstractions;
using TanPms.Application.Contracts;
using TanPms.Infrastructure.Persistence;
using TanPms.Infrastructure.Services;
using TanPms.WebApi.Infrastructure;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentUserContext, HttpCurrentUserContext>();
builder.Services.AddScoped<AuditableEntityInterceptor>();

var operationalService = new InMemoryOperationalService();
builder.Services.AddSingleton(operationalService);
builder.Services.AddSingleton<IPmsOperationalService>(operationalService);
builder.Services.AddSingleton<IDocumentNumberService>(operationalService);
builder.Services.AddSingleton<IAuditLogger>(operationalService);

builder.Services.AddExceptionHandler<ProblemDetailsExceptionHandler>();
builder.Services.AddProblemDetails();

var app = builder.Build();

app.UseExceptionHandler();

app.MapGet("/health/live", () => Results.Ok(new { status = "Live" }));
app.MapGet("/health/ready", () => Results.Ok(new { status = "Ready" }));

var adminGroup = app.MapGroup("/api/v1/admin");

adminGroup.MapGet("/properties/{propertyId:guid}/rack", (
    Guid propertyId,
    IPmsOperationalService pmsService,
    ICurrentUserContext userContext) =>
{
    var response = pmsService.GetRoomRack(propertyId, userContext);
    return Results.Ok(response);
});

adminGroup.MapPost("/stays/check-in", (
    CheckInStayRequest request,
    IPmsOperationalService pmsService,
    ICurrentUserContext userContext) =>
{
    var stay = pmsService.CheckInStay(request, userContext);
    return Results.Created($"/api/v1/admin/stays/{stay.Id}", stay);
});

var clientGroup = app.MapGroup("/api/v1/client");

clientGroup.MapGet("/dashboard", (
    IPmsOperationalService pmsService,
    ICurrentUserContext userContext) =>
{
    var dashboard = pmsService.GetClientDashboard(userContext);
    return Results.Ok(dashboard);
});

app.Run();

public partial class Program;
