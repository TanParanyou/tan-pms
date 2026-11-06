using TanPms.Application.ClientPortal;
using TanPms.Application.Common.Abstractions;
using TanPms.Application.Identity;
using TanPms.Application.Notifications;
using TanPms.Application.Properties;
using TanPms.Application.Rack;
using TanPms.Application.Rates;
using TanPms.Application.Stays;
using TanPms.Infrastructure.Persistence;
using TanPms.Infrastructure.Services;
using TanPms.WebApi.ErrorHandling;
using TanPms.WebApi.Security;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentUserContext, HttpCurrentUserContext>();
builder.Services.AddScoped<AuditableEntityInterceptor>();

var operationalService = new InMemoryOperationalService();
builder.Services.AddSingleton(operationalService);
builder.Services.AddSingleton<IPmsOperationalStore>(operationalService);
builder.Services.AddSingleton<IDocumentNumberService>(operationalService);
builder.Services.AddSingleton<IAuditLogger>(operationalService);
builder.Services.AddSingleton<INotificationSender>(operationalService);

builder.Services.AddScoped<LoginAuthSessionHandler>();
builder.Services.AddScoped<GetCurrentAuthSessionHandler>();
builder.Services.AddScoped<GetAdminRoleCatalogHandler>();
builder.Services.AddScoped<GetAdminUsersHandler>();
builder.Services.AddScoped<UpsertAdminUserHandler>();
builder.Services.AddScoped<DispatchAdminNotificationHandler>();
builder.Services.AddScoped<GetClientNotificationsHandler>();
builder.Services.AddScoped<GetAdminPropertyHierarchyHandler>();
builder.Services.AddScoped<UpsertAdminUnitMasterHandler>();
builder.Services.AddScoped<GetAdminPropertyRateCatalogHandler>();
builder.Services.AddScoped<UpsertAdminRatePlanHandler>();
builder.Services.AddScoped<UpsertAdminUtilityTariffHandler>();
builder.Services.AddScoped<UpsertAdminTaxProfileHandler>();
builder.Services.AddScoped<SimulateAdminRateAndTaxHandler>();
builder.Services.AddScoped<GetAdminRoomRackHandler>();
builder.Services.AddScoped<CheckInStayHandler>();
builder.Services.AddScoped<GetClientDashboardHandler>();

builder.Services.AddExceptionHandler<ProblemDetailsExceptionHandler>();
builder.Services.AddProblemDetails();

var app = builder.Build();

app.UseExceptionHandler();

app.MapGet("/health/live", () => Results.Ok(new { status = "Live" }));
app.MapGet("/health/ready", () => Results.Ok(new { status = "Ready" }));

var authGroup = app.MapGroup("/api/v1/auth");

authGroup.MapPost("/login", (
    LoginRequest request,
    LoginAuthSessionHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new LoginAuthSessionCommand(
        Scope: request.Scope,
        Identifier: request.Identifier,
        Password: request.Password));

    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

authGroup.MapGet("/me", (
    GetCurrentAuthSessionHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new GetCurrentAuthSessionQuery());
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

var adminGroup = app.MapGroup("/api/v1/admin");

adminGroup.MapGet("/roles", (
    GetAdminRoleCatalogHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new GetAdminRoleCatalogQuery());
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

adminGroup.MapGet("/users", (
    Guid? propertyId,
    GetAdminUsersHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new GetAdminUsersQuery(propertyId));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

adminGroup.MapPost("/users", (
    UpsertAdminUserRequest request,
    UpsertAdminUserHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new UpsertAdminUserCommand(
        Id: request.Id,
        Username: request.Username,
        FullName: request.FullName,
        Email: request.Email,
        RoleCode: request.RoleCode,
        AllowedPropertyIds: request.AllowedPropertyIds,
        IsActive: request.IsActive));

    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

adminGroup.MapPost("/notifications/dispatch", (
    DispatchNotificationRequest request,
    DispatchAdminNotificationHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new DispatchAdminNotificationCommand(
        PropertyId: request.PropertyId,
        CustomerId: request.CustomerId,
        Channel: request.Channel,
        TemplateKey: request.TemplateKey,
        Title: request.Title,
        Body: request.Body));

    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Created($"/api/v1/client/notifications/{result.Value!.Id}", result.Value);
});

adminGroup.MapGet("/properties/{propertyId:guid}/hierarchy", (
    Guid propertyId,
    GetAdminPropertyHierarchyHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new GetAdminPropertyHierarchyQuery(propertyId));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

adminGroup.MapPost("/properties/{propertyId:guid}/units", (
    Guid propertyId,
    UpsertUnitMasterRequest request,
    UpsertAdminUnitMasterHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new UpsertAdminUnitMasterCommand(propertyId, request));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

adminGroup.MapGet("/properties/{propertyId:guid}/rates", (
    Guid propertyId,
    GetAdminPropertyRateCatalogHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new GetAdminPropertyRateCatalogQuery(propertyId));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

adminGroup.MapPost("/properties/{propertyId:guid}/rates/plans", (
    Guid propertyId,
    UpsertRatePlanRequest request,
    UpsertAdminRatePlanHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new UpsertAdminRatePlanCommand(propertyId, request));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

adminGroup.MapPut("/properties/{propertyId:guid}/rates/utilities", (
    Guid propertyId,
    UpsertUtilityTariffRequest request,
    UpsertAdminUtilityTariffHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new UpsertAdminUtilityTariffCommand(propertyId, request));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

adminGroup.MapPost("/properties/{propertyId:guid}/rates/taxes", (
    Guid propertyId,
    UpsertTaxProfileRequest request,
    UpsertAdminTaxProfileHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new UpsertAdminTaxProfileCommand(propertyId, request));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

adminGroup.MapPost("/properties/{propertyId:guid}/rates/simulate", (
    Guid propertyId,
    RateSimulationRequest request,
    SimulateAdminRateAndTaxHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new SimulateAdminRateAndTaxCommand(propertyId, request));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

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

clientGroup.MapGet("/notifications", (
    GetClientNotificationsHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new GetClientNotificationsQuery());
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

app.Run();

public partial class Program;
