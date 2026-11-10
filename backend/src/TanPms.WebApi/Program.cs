using TanPms.Application.Analytics;
using TanPms.Application.Billing;
using TanPms.Application.Cashier;
using TanPms.Application.Client;
using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Contracts;
using TanPms.Application.Customers;
using TanPms.Application.Files;
using TanPms.Application.Housekeeping;
using TanPms.Application.Identity;
using TanPms.Application.Leases;
using TanPms.Application.Meters;
using TanPms.Application.Notifications;
using TanPms.Application.Parcels;
using TanPms.Application.Payments;
using TanPms.Application.Properties;
using TanPms.Application.Rack;
using TanPms.Application.Rates;
using TanPms.Application.Reservations;
using TanPms.Application.Stays;
using TanPms.Application.WorkOrders;
using Microsoft.AspNetCore.Mvc;
using TanPms.Infrastructure;
using TanPms.Infrastructure.Services;
using TanPms.WebApi.Background;
using TanPms.WebApi.ErrorHandling;
using TanPms.WebApi.Security;

const string FrontendCorsPolicy = "TanPmsFrontend";

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentUserContext, HttpCurrentUserContext>();
builder.Services.AddTanPmsInfrastructure(builder.Configuration);

builder.Services.AddCors(options =>
{
    options.AddPolicy(FrontendCorsPolicy, policy =>
    {
        policy
            .WithOrigins("http://localhost:3000", "http://127.0.0.1:3000")
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});

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
builder.Services.AddScoped<GetAdminAvailabilityHandler>();
builder.Services.AddScoped<GetAdminReservationsHandler>();
builder.Services.AddScoped<CreateAdminReservationHandler>();
builder.Services.AddScoped<AssignAdminReservationUnitHandler>();
builder.Services.AddScoped<ConfirmAdminReservationHandler>();
builder.Services.AddScoped<CancelAdminReservationHandler>();
builder.Services.AddScoped<GetClientAvailabilityHandler>();
builder.Services.AddScoped<GetClientReservationsHandler>();
builder.Services.AddScoped<CreateClientHoldReservationHandler>();
builder.Services.AddScoped<SubmitClientReservationSlipHandler>();
builder.Services.AddScoped<GetAdminRoomRackHandler>();
builder.Services.AddScoped<CheckInStayHandler>();
builder.Services.AddScoped<GetAdminStaysHandler>();
builder.Services.AddScoped<ExtendAdminStayHandler>();
builder.Services.AddScoped<AddAdminFolioChargeHandler>();
builder.Services.AddScoped<RecordAdminFolioPaymentHandler>();
builder.Services.AddScoped<CheckOutAdminStayHandler>();
builder.Services.AddScoped<GetAdminRegulatoryExportHandler>();
builder.Services.AddScoped<GetAdminLeasesHandler>();
builder.Services.AddScoped<GetAdminLeaseHandler>();
builder.Services.AddScoped<SearchAdminCustomersHandler>();
builder.Services.AddScoped<GetAdminMeterReadingSheetHandler>();
builder.Services.AddScoped<SaveAdminMeterReadingsHandler>();
builder.Services.AddScoped<RunAdminBatchInvoicesHandler>();
builder.Services.AddScoped<GetAdminInvoicesHandler>();
builder.Services.AddScoped<IssueAdminInvoicesForPeriodHandler>();
builder.Services.AddScoped<IssueAdminInvoiceHandler>();
builder.Services.AddScoped<DeleteAdminInvoiceHandler>();
builder.Services.AddScoped<OpenAdminCashierShiftHandler>();
builder.Services.AddScoped<GetCurrentAdminCashierShiftHandler>();
builder.Services.AddScoped<GetAdminCashierShiftsHandler>();
builder.Services.AddScoped<CloseAdminCashierShiftHandler>();
builder.Services.AddScoped<ReconcileAdminCashierShiftHandler>();
builder.Services.AddScoped<GetAdminDepositLedgersHandler>();
builder.Services.AddScoped<SubmitClientPaymentSlipHandler>();
builder.Services.AddScoped<GetClientInvoiceSlipsHandler>();
builder.Services.AddScoped<GetAdminPaymentSlipsHandler>();
builder.Services.AddScoped<ApproveAdminPaymentSlipHandler>();
builder.Services.AddScoped<RejectAdminPaymentSlipHandler>();
builder.Services.AddScoped<GetAdminHousekeepingTasksHandler>();
builder.Services.AddScoped<StartAdminHousekeepingTaskHandler>();
builder.Services.AddScoped<CompleteAdminHousekeepingTaskHandler>();
builder.Services.AddScoped<AssignAdminHousekeepingTaskHandler>();
builder.Services.AddScoped<CreateAdminWorkOrderHandler>();
builder.Services.AddScoped<CreateClientWorkOrderHandler>();
builder.Services.AddScoped<GetAdminWorkOrdersHandler>();
builder.Services.AddScoped<GetClientWorkOrdersHandler>();
builder.Services.AddScoped<AssignAdminWorkOrderHandler>();
builder.Services.AddScoped<ResolveAdminWorkOrderHandler>();
builder.Services.AddScoped<ReceiveAdminParcelHandler>();
builder.Services.AddScoped<GetAdminParcelsHandler>();
builder.Services.AddScoped<PickUpAdminParcelHandler>();
builder.Services.AddScoped<GetClientParcelsHandler>();
builder.Services.AddScoped<CreateAdminLeaseHandler>();
builder.Services.AddScoped<AddAdminLeaseOccupantHandler>();
builder.Services.AddScoped<AddAdminLeaseVehicleHandler>();
builder.Services.AddScoped<RenewAdminLeaseHandler>();
builder.Services.AddScoped<GiveAdminLeaseMoveOutNoticeHandler>();
builder.Services.AddScoped<SettleAdminLeaseMoveOutHandler>();
builder.Services.AddScoped<GetClientDashboardHandler>();
builder.Services.AddScoped<GetAdminBillingSettingsHandler>();
builder.Services.AddScoped<UpdateAdminBillingSettingsHandler>();
builder.Services.AddScoped<LogoutAuthSessionHandler>();
builder.Services.AddHostedService<OverdueInvoiceSweeper>();
builder.Services.AddScoped<GetAdminUserHandler>();
builder.Services.AddScoped<DeactivateAdminUserHandler>();
builder.Services.AddScoped<ReactivateAdminUserHandler>();
builder.Services.AddScoped<GetAdminUnitHandler>();
builder.Services.AddScoped<UpsertAdminBuildingHandler>();
builder.Services.AddScoped<UpsertAdminFloorHandler>();
builder.Services.AddScoped<UpsertAdminUnitTypeHandler>();
builder.Services.AddScoped<DeleteAdminUnitHandler>();
builder.Services.AddScoped<DeleteAdminBuildingHandler>();
builder.Services.AddScoped<DeleteAdminFloorHandler>();
builder.Services.AddScoped<DeleteAdminUnitTypeHandler>();
builder.Services.AddScoped<GetAdminRatePlanHandler>();
builder.Services.AddScoped<GetAdminUtilityTariffHandler>();
builder.Services.AddScoped<GetAdminTaxProfileHandler>();
builder.Services.AddScoped<DeleteAdminRatePlanHandler>();
builder.Services.AddScoped<DeleteAdminUtilityTariffHandler>();
builder.Services.AddScoped<DeleteAdminTaxProfileHandler>();
builder.Services.AddScoped<GetAdminReservationHandler>();
builder.Services.AddScoped<UpdateAdminReservationHandler>();
builder.Services.AddScoped<DeleteAdminReservationHandler>();
builder.Services.AddScoped<GetAdminStayHandler>();
builder.Services.AddScoped<AddAdminStayOccupantHandler>();
builder.Services.AddScoped<UpdateAdminStayOccupantHandler>();
builder.Services.AddScoped<DeleteAdminStayOccupantHandler>();
builder.Services.AddScoped<UpdateAdminStayHandler>();
builder.Services.AddScoped<VoidAdminFolioChargeHandler>();
builder.Services.AddScoped<ReverseAdminFolioPaymentHandler>();
builder.Services.AddScoped<CancelAdminStayHandler>();
builder.Services.AddScoped<GetClientLeasesHandler>();
builder.Services.AddScoped<GetClientLeaseHandler>();
builder.Services.AddScoped<GetClientInvoicesHandler>();
builder.Services.AddScoped<GetClientInvoiceHandler>();
builder.Services.AddScoped<GetClientUtilityUsageHandler>();
builder.Services.AddScoped<GetClientPaymentSlipsHandler>();
builder.Services.AddScoped<GetClientReservationHandler>();
builder.Services.AddScoped<CancelClientReservationHandler>();
builder.Services.AddScoped<CreateClientLeaseIntentHandler>();
builder.Services.AddScoped<GetClientLeaseIntentsHandler>();
builder.Services.AddScoped<UpdateClientLeaseIntentHandler>();
builder.Services.AddScoped<WithdrawClientLeaseIntentHandler>();
builder.Services.AddScoped<GetAdminLeaseIntentsHandler>();
builder.Services.AddScoped<ApproveAdminLeaseIntentHandler>();
builder.Services.AddScoped<RejectAdminLeaseIntentHandler>();
builder.Services.AddScoped<GetAdminOccupancyReportHandler>();
builder.Services.AddScoped<GetAdminRevParReportHandler>();
builder.Services.AddScoped<GetAdminAgingReportHandler>();
builder.Services.AddScoped<GetAdminCashierShiftSummaryReportHandler>();
builder.Services.AddScoped<GetAdminDepositSummaryReportHandler>();
builder.Services.AddScoped<UploadAdminFileHandler>();
builder.Services.AddScoped<UploadClientFileHandler>();
builder.Services.AddScoped<GetAdminFileHandler>();
builder.Services.AddScoped<GetClientFileHandler>();
builder.Services.AddScoped<GetAdminLeaseContractPdfHandler>();
builder.Services.AddScoped<GetAdminReceiptsHandler>();
builder.Services.AddScoped<GetClientReceiptsHandler>();
builder.Services.AddScoped<GetAdminReceiptPdfHandler>();
builder.Services.AddScoped<GetClientReceiptPdfHandler>();
builder.Services.AddScoped<UpdateAdminLeaseHandler>();
builder.Services.AddScoped<UpdateAdminLeaseOccupantHandler>();
builder.Services.AddScoped<DeleteAdminLeaseOccupantHandler>();
builder.Services.AddScoped<UpdateAdminLeaseVehicleHandler>();
builder.Services.AddScoped<DeleteAdminLeaseVehicleHandler>();
builder.Services.AddScoped<CancelAdminLeaseHandler>();
builder.Services.AddScoped<DeleteAdminMeterReadingHandler>();
builder.Services.AddScoped<GetAdminInvoiceHandler>();
builder.Services.AddScoped<AddAdminInvoiceLineHandler>();
builder.Services.AddScoped<UpdateAdminInvoiceLineHandler>();
builder.Services.AddScoped<DeleteAdminInvoiceLineHandler>();
builder.Services.AddScoped<VoidAdminInvoiceHandler>();
builder.Services.AddScoped<GetAdminCashierShiftHandler>();
builder.Services.AddScoped<CancelAdminCashierShiftHandler>();
builder.Services.AddScoped<UpdateAdminCashierShiftRemarkHandler>();
builder.Services.AddScoped<GetAdminDepositLedgerHandler>();
builder.Services.AddScoped<UpdateClientPaymentSlipHandler>();
builder.Services.AddScoped<WithdrawClientPaymentSlipHandler>();
builder.Services.AddScoped<GetAdminPaymentSlipHandler>();
builder.Services.AddScoped<CreateAdminHousekeepingTaskHandler>();
builder.Services.AddScoped<UpdateAdminHousekeepingTaskHandler>();
builder.Services.AddScoped<DeleteAdminHousekeepingTaskHandler>();
builder.Services.AddScoped<GetAdminWorkOrderHandler>();
builder.Services.AddScoped<GetClientWorkOrderHandler>();
builder.Services.AddScoped<UpdateAdminWorkOrderHandler>();
builder.Services.AddScoped<UpdateClientWorkOrderHandler>();
builder.Services.AddScoped<CancelAdminWorkOrderHandler>();
builder.Services.AddScoped<CancelClientWorkOrderHandler>();
builder.Services.AddScoped<GetAdminParcelHandler>();
builder.Services.AddScoped<GetClientParcelHandler>();
builder.Services.AddScoped<UpdateAdminParcelHandler>();
builder.Services.AddScoped<VoidAdminParcelHandler>();

builder.Services.AddExceptionHandler<ProblemDetailsExceptionHandler>();
builder.Services.AddProblemDetails();

var app = builder.Build();

app.UseExceptionHandler();
app.UseCors(FrontendCorsPolicy);

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
    int? page,
    int? pageSize,
    GetAdminUsersHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new GetAdminUsersQuery(propertyId, Page: page, PageSize: pageSize));
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

adminGroup.MapGet("/properties/{propertyId:guid}/availability", (
    Guid propertyId,
    string stayMode,
    DateTimeOffset slotStartAt,
    DateTimeOffset slotEndAt,
    GetAdminAvailabilityHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new GetAdminAvailabilityQuery(
        propertyId,
        stayMode,
        slotStartAt,
        slotEndAt));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

adminGroup.MapGet("/properties/{propertyId:guid}/reservations", (
    Guid propertyId,
    string? status,
    string? stayMode,
    int? page,
    int? pageSize,
    GetAdminReservationsHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new GetAdminReservationsQuery(propertyId, status, stayMode, Page: page, PageSize: pageSize));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

adminGroup.MapPost("/properties/{propertyId:guid}/reservations", (
    Guid propertyId,
    CreateAdminReservationRequest request,
    CreateAdminReservationHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new CreateAdminReservationCommand(propertyId, request));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Created($"/api/v1/admin/properties/{propertyId}/reservations/{result.Value!.Id}", result.Value);
});

adminGroup.MapPost("/properties/{propertyId:guid}/reservations/{reservationId:guid}/assign-unit", (
    Guid propertyId,
    Guid reservationId,
    AssignReservationUnitRequest request,
    AssignAdminReservationUnitHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new AssignAdminReservationUnitCommand(propertyId, reservationId, request));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

adminGroup.MapPost("/properties/{propertyId:guid}/reservations/{reservationId:guid}/confirm", (
    Guid propertyId,
    Guid reservationId,
    ConfirmAdminReservationHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new ConfirmAdminReservationCommand(propertyId, reservationId));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

adminGroup.MapPost("/properties/{propertyId:guid}/reservations/{reservationId:guid}/cancel", (
    Guid propertyId,
    Guid reservationId,
    CancelReservationRequest request,
    CancelAdminReservationHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new CancelAdminReservationCommand(propertyId, reservationId, request));
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
        OverrideReason: request.OverrideReason,
        ReservationId: request.ReservationId,
        ExpectedCheckOutAt: request.ExpectedCheckOutAt,
        InitialRoomChargeAmount: request.InitialRoomChargeAmount,
        Occupants: request.Occupants);

    var result = handler.Handle(command);
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Created($"/api/v1/admin/stays/{result.Value!.Id}", result.Value);
});

adminGroup.MapGet("/properties/{propertyId:guid}/stays", (
    Guid propertyId,
    string? status,
    string? stayMode,
    int? page,
    int? pageSize,
    GetAdminStaysHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new GetAdminStaysQuery(propertyId, status, stayMode, Page: page, PageSize: pageSize));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

adminGroup.MapPost("/properties/{propertyId:guid}/stays/{stayId:guid}/extend", (
    Guid propertyId,
    Guid stayId,
    ExtendStayRequest request,
    ExtendAdminStayHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new ExtendAdminStayCommand(propertyId, stayId, request));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

adminGroup.MapPost("/properties/{propertyId:guid}/stays/{stayId:guid}/folio/charges", (
    Guid propertyId,
    Guid stayId,
    AddFolioChargeRequest request,
    AddAdminFolioChargeHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new AddAdminFolioChargeCommand(propertyId, stayId, request));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

adminGroup.MapPost("/properties/{propertyId:guid}/stays/{stayId:guid}/folio/payments", (
    Guid propertyId,
    Guid stayId,
    RecordFolioPaymentRequest request,
    RecordAdminFolioPaymentHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new RecordAdminFolioPaymentCommand(propertyId, stayId, request));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

adminGroup.MapPost("/properties/{propertyId:guid}/stays/{stayId:guid}/check-out", (
    Guid propertyId,
    Guid stayId,
    CheckOutStayRequest request,
    CheckOutAdminStayHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new CheckOutAdminStayCommand(propertyId, stayId, request));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

adminGroup.MapGet("/properties/{propertyId:guid}/regulatory-exports", (
    Guid propertyId,
    string reportType,
    bool? unmaskPii,
    GetAdminRegulatoryExportHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new GetAdminRegulatoryExportQuery(
        propertyId,
        reportType,
        unmaskPii ?? false));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

adminGroup.MapGet("/properties/{propertyId:guid}/leases", (
    Guid propertyId,
    string? status,
    string? licensePlate,
    int? page,
    int? pageSize,
    GetAdminLeasesHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new GetAdminLeasesQuery(propertyId, status, licensePlate, Page: page, PageSize: pageSize));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

adminGroup.MapGet("/properties/{propertyId:guid}/leases/{leaseId:guid}", (
    Guid propertyId,
    Guid leaseId,
    GetAdminLeaseHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new GetAdminLeaseQuery(propertyId, leaseId));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

adminGroup.MapGet("/properties/{propertyId:guid}/customers", (
    Guid propertyId,
    string? search,
    SearchAdminCustomersHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new SearchAdminCustomersQuery(propertyId, search));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

adminGroup.MapPost("/properties/{propertyId:guid}/leases", (
    Guid propertyId,
    CreateLeaseRequest request,
    CreateAdminLeaseHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new CreateAdminLeaseCommand(propertyId, request));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Created($"/api/v1/admin/properties/{propertyId}/leases/{result.Value!.Id}", result.Value);
});

adminGroup.MapPost("/properties/{propertyId:guid}/leases/{leaseId:guid}/occupants", (
    Guid propertyId,
    Guid leaseId,
    LeaseOccupantRequest request,
    AddAdminLeaseOccupantHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new AddAdminLeaseOccupantCommand(propertyId, leaseId, request));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

adminGroup.MapPost("/properties/{propertyId:guid}/leases/{leaseId:guid}/vehicles", (
    Guid propertyId,
    Guid leaseId,
    LeaseVehicleRequest request,
    AddAdminLeaseVehicleHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new AddAdminLeaseVehicleCommand(propertyId, leaseId, request));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

adminGroup.MapPost("/properties/{propertyId:guid}/leases/{leaseId:guid}/renew", (
    Guid propertyId,
    Guid leaseId,
    RenewLeaseRequest request,
    RenewAdminLeaseHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new RenewAdminLeaseCommand(propertyId, leaseId, request));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

adminGroup.MapPost("/properties/{propertyId:guid}/leases/{leaseId:guid}/move-out-notice", (
    Guid propertyId,
    Guid leaseId,
    GiveAdminLeaseMoveOutNoticeHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new GiveAdminLeaseMoveOutNoticeCommand(propertyId, leaseId));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

adminGroup.MapPost("/properties/{propertyId:guid}/leases/{leaseId:guid}/settle-move-out", (
    Guid propertyId,
    Guid leaseId,
    SettleLeaseMoveOutRequest request,
    SettleAdminLeaseMoveOutHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new SettleAdminLeaseMoveOutCommand(propertyId, leaseId, request));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

adminGroup.MapGet("/properties/{propertyId:guid}/meter-readings", (
    Guid propertyId,
    string period,
    Guid? buildingId,
    GetAdminMeterReadingSheetHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new GetAdminMeterReadingSheetQuery(propertyId, period, buildingId));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

adminGroup.MapPut("/properties/{propertyId:guid}/meter-readings", (
    Guid propertyId,
    SaveMeterReadingsRequest request,
    SaveAdminMeterReadingsHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new SaveAdminMeterReadingsCommand(propertyId, request));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

adminGroup.MapPost("/properties/{propertyId:guid}/billing/batch-invoice-runs", (
    Guid propertyId,
    BatchInvoiceRunRequest request,
    RunAdminBatchInvoicesHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new RunAdminBatchInvoicesCommand(propertyId, request));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

adminGroup.MapPost("/properties/{propertyId:guid}/billing/batch-invoice-runs/issue", (
    Guid propertyId,
    IssueInvoicesRequest request,
    IssueAdminInvoicesForPeriodHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new IssueAdminInvoicesForPeriodCommand(propertyId, request));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

adminGroup.MapGet("/properties/{propertyId:guid}/invoices", (
    Guid propertyId,
    string? period,
    string? status,
    int? page,
    int? pageSize,
    GetAdminInvoicesHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new GetAdminInvoicesQuery(propertyId, period, status, Page: page, PageSize: pageSize));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

adminGroup.MapPost("/properties/{propertyId:guid}/invoices/{invoiceId:guid}/issue", (
    Guid propertyId,
    Guid invoiceId,
    IssueAdminInvoiceHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new IssueAdminInvoiceCommand(propertyId, invoiceId));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

adminGroup.MapDelete("/properties/{propertyId:guid}/invoices/{invoiceId:guid}", (
    Guid propertyId,
    Guid invoiceId,
    DeleteAdminInvoiceHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new DeleteAdminInvoiceCommand(propertyId, invoiceId));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

adminGroup.MapPost("/properties/{propertyId:guid}/cashier/shifts/open", (
    Guid propertyId,
    OpenCashierShiftRequest request,
    OpenAdminCashierShiftHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new OpenAdminCashierShiftCommand(propertyId, request));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Created($"/api/v1/admin/properties/{propertyId}/cashier/shifts/{result.Value!.Id}", result.Value);
});

adminGroup.MapGet("/properties/{propertyId:guid}/cashier/shifts/current", (
    Guid propertyId,
    GetCurrentAdminCashierShiftHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new GetCurrentAdminCashierShiftQuery(propertyId));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

adminGroup.MapGet("/properties/{propertyId:guid}/cashier/shifts", (
    Guid propertyId,
    string? status,
    int? page,
    int? pageSize,
    GetAdminCashierShiftsHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new GetAdminCashierShiftsQuery(propertyId, status, Page: page, PageSize: pageSize));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

adminGroup.MapPost("/properties/{propertyId:guid}/cashier/shifts/{shiftId:guid}/close", (
    Guid propertyId,
    Guid shiftId,
    CloseCashierShiftRequest request,
    CloseAdminCashierShiftHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new CloseAdminCashierShiftCommand(propertyId, shiftId, request));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

adminGroup.MapPost("/properties/{propertyId:guid}/cashier/shifts/{shiftId:guid}/reconcile", (
    Guid propertyId,
    Guid shiftId,
    ReconcileCashierShiftRequest request,
    ReconcileAdminCashierShiftHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new ReconcileAdminCashierShiftCommand(propertyId, shiftId, request));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

adminGroup.MapGet("/properties/{propertyId:guid}/deposit-ledgers", (
    Guid propertyId,
    string? type,
    int? page,
    int? pageSize,
    GetAdminDepositLedgersHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new GetAdminDepositLedgersQuery(propertyId, type, Page: page, PageSize: pageSize));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

adminGroup.MapGet("/properties/{propertyId:guid}/payments/slips", (
    Guid propertyId,
    string? status,
    int? page,
    int? pageSize,
    GetAdminPaymentSlipsHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new GetAdminPaymentSlipsQuery(propertyId, status, Page: page, PageSize: pageSize));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

adminGroup.MapPost("/properties/{propertyId:guid}/payments/slips/{slipId:guid}/approve", (
    Guid propertyId,
    Guid slipId,
    ApproveAdminPaymentSlipHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new ApproveAdminPaymentSlipCommand(propertyId, slipId));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

adminGroup.MapPost("/properties/{propertyId:guid}/payments/slips/{slipId:guid}/reject", (
    Guid propertyId,
    Guid slipId,
    RejectPaymentSlipRequest request,
    RejectAdminPaymentSlipHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new RejectAdminPaymentSlipCommand(propertyId, slipId, request));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

adminGroup.MapGet("/properties/{propertyId:guid}/housekeeping/tasks", (
    Guid propertyId,
    string? status,
    Guid? buildingId,
    int? page,
    int? pageSize,
    GetAdminHousekeepingTasksHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new GetAdminHousekeepingTasksQuery(propertyId, status, buildingId, Page: page, PageSize: pageSize));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

adminGroup.MapPost("/properties/{propertyId:guid}/housekeeping/tasks/{taskId:guid}/start", (
    Guid propertyId,
    Guid taskId,
    StartAdminHousekeepingTaskHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new StartAdminHousekeepingTaskCommand(propertyId, taskId));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

adminGroup.MapPost("/properties/{propertyId:guid}/housekeeping/tasks/{taskId:guid}/complete", (
    Guid propertyId,
    Guid taskId,
    CompleteHousekeepingTaskRequest request,
    CompleteAdminHousekeepingTaskHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new CompleteAdminHousekeepingTaskCommand(propertyId, taskId, request));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

adminGroup.MapPost("/properties/{propertyId:guid}/housekeeping/tasks/{taskId:guid}/assign", (
    Guid propertyId,
    Guid taskId,
    AssignHousekeepingTaskRequest request,
    AssignAdminHousekeepingTaskHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new AssignAdminHousekeepingTaskCommand(propertyId, taskId, request));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

adminGroup.MapGet("/properties/{propertyId:guid}/work-orders", (
    Guid propertyId,
    string? status,
    int? page,
    int? pageSize,
    GetAdminWorkOrdersHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new GetAdminWorkOrdersQuery(propertyId, status, Page: page, PageSize: pageSize));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

adminGroup.MapPost("/properties/{propertyId:guid}/work-orders", (
    Guid propertyId,
    CreateWorkOrderRequest request,
    CreateAdminWorkOrderHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new CreateAdminWorkOrderCommand(propertyId, request));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Created($"/api/v1/admin/properties/{propertyId}/work-orders/{result.Value!.Id}", result.Value);
});

adminGroup.MapPost("/properties/{propertyId:guid}/work-orders/{workOrderId:guid}/assign", (
    Guid propertyId,
    Guid workOrderId,
    AssignWorkOrderRequest request,
    AssignAdminWorkOrderHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new AssignAdminWorkOrderCommand(propertyId, workOrderId, request));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

adminGroup.MapPost("/properties/{propertyId:guid}/work-orders/{workOrderId:guid}/resolve", (
    Guid propertyId,
    Guid workOrderId,
    ResolveWorkOrderRequest request,
    ResolveAdminWorkOrderHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new ResolveAdminWorkOrderCommand(propertyId, workOrderId, request));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

adminGroup.MapGet("/properties/{propertyId:guid}/parcels", (
    Guid propertyId,
    string? status,
    int? page,
    int? pageSize,
    GetAdminParcelsHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new GetAdminParcelsQuery(propertyId, status, Page: page, PageSize: pageSize));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

adminGroup.MapPost("/properties/{propertyId:guid}/parcels", (
    Guid propertyId,
    ReceiveParcelRequest request,
    ReceiveAdminParcelHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new ReceiveAdminParcelCommand(propertyId, request));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Created($"/api/v1/admin/properties/{propertyId}/parcels/{result.Value!.Id}", result.Value);
});

adminGroup.MapPost("/properties/{propertyId:guid}/parcels/{parcelId:guid}/pickup", (
    Guid propertyId,
    Guid parcelId,
    PickUpParcelRequest request,
    PickUpAdminParcelHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new PickUpAdminParcelCommand(propertyId, parcelId, request));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

adminGroup.MapPut("/properties/{propertyId:guid}/leases/{leaseId:guid}", (
    Guid propertyId,
    Guid leaseId,
    UpdateLeaseRequest request,
    UpdateAdminLeaseHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new UpdateAdminLeaseCommand(propertyId, leaseId, request));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

adminGroup.MapPost("/properties/{propertyId:guid}/leases/{leaseId:guid}/cancel", (
    Guid propertyId,
    Guid leaseId,
    CancelLeaseRequest request,
    CancelAdminLeaseHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new CancelAdminLeaseCommand(propertyId, leaseId, request));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

adminGroup.MapPut("/properties/{propertyId:guid}/leases/{leaseId:guid}/occupants/{occupantId:guid}", (
    Guid propertyId,
    Guid leaseId,
    Guid occupantId,
    UpdateLeaseOccupantRequest request,
    UpdateAdminLeaseOccupantHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new UpdateAdminLeaseOccupantCommand(propertyId, leaseId, occupantId, request));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

adminGroup.MapDelete("/properties/{propertyId:guid}/leases/{leaseId:guid}/occupants/{occupantId:guid}", (
    Guid propertyId,
    Guid leaseId,
    Guid occupantId,
    DeleteAdminLeaseOccupantHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new DeleteAdminLeaseOccupantCommand(propertyId, leaseId, occupantId));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

adminGroup.MapPut("/properties/{propertyId:guid}/leases/{leaseId:guid}/vehicles/{vehicleId:guid}", (
    Guid propertyId,
    Guid leaseId,
    Guid vehicleId,
    LeaseVehicleRequest request,
    UpdateAdminLeaseVehicleHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new UpdateAdminLeaseVehicleCommand(propertyId, leaseId, vehicleId, request));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

adminGroup.MapDelete("/properties/{propertyId:guid}/leases/{leaseId:guid}/vehicles/{vehicleId:guid}", (
    Guid propertyId,
    Guid leaseId,
    Guid vehicleId,
    DeleteAdminLeaseVehicleHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new DeleteAdminLeaseVehicleCommand(propertyId, leaseId, vehicleId));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

adminGroup.MapDelete("/properties/{propertyId:guid}/meter-readings/units/{unitId:guid}", (
    Guid propertyId,
    Guid unitId,
    string period,
    string? overrideReason,
    DeleteAdminMeterReadingHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new DeleteAdminMeterReadingCommand(propertyId, unitId, period, overrideReason));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

adminGroup.MapGet("/properties/{propertyId:guid}/invoices/{invoiceId:guid}", (
    Guid propertyId,
    Guid invoiceId,
    GetAdminInvoiceHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new GetAdminInvoiceQuery(propertyId, invoiceId));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

adminGroup.MapPost("/properties/{propertyId:guid}/invoices/{invoiceId:guid}/lines", (
    Guid propertyId,
    Guid invoiceId,
    InvoiceLineRequest request,
    AddAdminInvoiceLineHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new AddAdminInvoiceLineCommand(propertyId, invoiceId, request));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

adminGroup.MapPut("/properties/{propertyId:guid}/invoices/{invoiceId:guid}/lines/{lineId:guid}", (
    Guid propertyId,
    Guid invoiceId,
    Guid lineId,
    InvoiceLineRequest request,
    UpdateAdminInvoiceLineHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new UpdateAdminInvoiceLineCommand(propertyId, invoiceId, lineId, request));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

adminGroup.MapDelete("/properties/{propertyId:guid}/invoices/{invoiceId:guid}/lines/{lineId:guid}", (
    Guid propertyId,
    Guid invoiceId,
    Guid lineId,
    DeleteAdminInvoiceLineHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new DeleteAdminInvoiceLineCommand(propertyId, invoiceId, lineId));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

adminGroup.MapPost("/properties/{propertyId:guid}/invoices/{invoiceId:guid}/void", (
    Guid propertyId,
    Guid invoiceId,
    ReasonRequest request,
    VoidAdminInvoiceHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new VoidAdminInvoiceCommand(propertyId, invoiceId, request));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

adminGroup.MapGet("/properties/{propertyId:guid}/cashier/shifts/{shiftId:guid}", (
    Guid propertyId,
    Guid shiftId,
    GetAdminCashierShiftHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new GetAdminCashierShiftQuery(propertyId, shiftId));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

adminGroup.MapPost("/properties/{propertyId:guid}/cashier/shifts/{shiftId:guid}/cancel", (
    Guid propertyId,
    Guid shiftId,
    ReasonRequest request,
    CancelAdminCashierShiftHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new CancelAdminCashierShiftCommand(propertyId, shiftId, request));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

adminGroup.MapPut("/properties/{propertyId:guid}/cashier/shifts/{shiftId:guid}/variance-remark", (
    Guid propertyId,
    Guid shiftId,
    UpdateCashierShiftRemarkRequest request,
    UpdateAdminCashierShiftRemarkHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new UpdateAdminCashierShiftRemarkCommand(propertyId, shiftId, request));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

adminGroup.MapGet("/properties/{propertyId:guid}/deposit-ledgers/{ledgerId:guid}", (
    Guid propertyId,
    Guid ledgerId,
    GetAdminDepositLedgerHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new GetAdminDepositLedgerQuery(propertyId, ledgerId));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

adminGroup.MapGet("/properties/{propertyId:guid}/payments/slips/{slipId:guid}", (
    Guid propertyId,
    Guid slipId,
    GetAdminPaymentSlipHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new GetAdminPaymentSlipQuery(propertyId, slipId));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

adminGroup.MapPost("/properties/{propertyId:guid}/housekeeping/tasks", (
    Guid propertyId,
    CreateHousekeepingTaskRequest request,
    CreateAdminHousekeepingTaskHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new CreateAdminHousekeepingTaskCommand(propertyId, request));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Created($"/api/v1/admin/properties/{propertyId}/housekeeping/tasks/{result.Value!.Id}", result.Value);
});

adminGroup.MapPut("/properties/{propertyId:guid}/housekeeping/tasks/{taskId:guid}", (
    Guid propertyId,
    Guid taskId,
    UpdateHousekeepingTaskRequest request,
    UpdateAdminHousekeepingTaskHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new UpdateAdminHousekeepingTaskCommand(propertyId, taskId, request));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

adminGroup.MapDelete("/properties/{propertyId:guid}/housekeeping/tasks/{taskId:guid}", (
    Guid propertyId,
    Guid taskId,
    DeleteAdminHousekeepingTaskHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new DeleteAdminHousekeepingTaskCommand(propertyId, taskId));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

adminGroup.MapGet("/properties/{propertyId:guid}/work-orders/{workOrderId:guid}", (
    Guid propertyId,
    Guid workOrderId,
    GetAdminWorkOrderHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new GetAdminWorkOrderQuery(propertyId, workOrderId));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

adminGroup.MapPut("/properties/{propertyId:guid}/work-orders/{workOrderId:guid}", (
    Guid propertyId,
    Guid workOrderId,
    UpdateWorkOrderRequest request,
    UpdateAdminWorkOrderHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new UpdateAdminWorkOrderCommand(propertyId, workOrderId, request));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

adminGroup.MapPost("/properties/{propertyId:guid}/work-orders/{workOrderId:guid}/cancel", (
    Guid propertyId,
    Guid workOrderId,
    ReasonRequest request,
    CancelAdminWorkOrderHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new CancelAdminWorkOrderCommand(propertyId, workOrderId, request));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

adminGroup.MapGet("/properties/{propertyId:guid}/parcels/{parcelId:guid}", (
    Guid propertyId,
    Guid parcelId,
    GetAdminParcelHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new GetAdminParcelQuery(propertyId, parcelId));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

adminGroup.MapPut("/properties/{propertyId:guid}/parcels/{parcelId:guid}", (
    Guid propertyId,
    Guid parcelId,
    ReceiveParcelRequest request,
    UpdateAdminParcelHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new UpdateAdminParcelCommand(propertyId, parcelId, request));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

adminGroup.MapPost("/properties/{propertyId:guid}/parcels/{parcelId:guid}/void", (
    Guid propertyId,
    Guid parcelId,
    ReasonRequest request,
    VoidAdminParcelHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new VoidAdminParcelCommand(propertyId, parcelId, request));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

// Multipart upload; API callers authenticate with headers/tokens (no cookies), so antiforgery does not apply.
adminGroup.MapPost("/files", (
    [FromForm] Guid propertyId,
    [FromForm] string purpose,
    IFormFile file,
    UploadAdminFileHandler handler,
    HttpContext httpContext) =>
{
    using var content = file.OpenReadStream();
    var result = handler.Handle(new UploadAdminFileCommand(propertyId, purpose, content));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Created($"/api/v1/admin/files/{result.Value!.FileKey}", result.Value);
}).DisableAntiforgery();

adminGroup.MapGet("/files/{**fileKey}", (
    string fileKey,
    GetAdminFileHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new GetAdminFileQuery(fileKey));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.File(result.Value!.Content, result.Value.ContentType, result.Value.FileKey);
});

adminGroup.MapGet("/properties/{propertyId:guid}/leases/{leaseId:guid}/contract.pdf", (
    Guid propertyId,
    Guid leaseId,
    GetAdminLeaseContractPdfHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new GetAdminLeaseContractPdfQuery(propertyId, leaseId));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.File(result.Value!.Content, "application/pdf", result.Value.FileName);
});

adminGroup.MapGet("/properties/{propertyId:guid}/receipts", (
    Guid propertyId,
    Guid? invoiceId,
    GetAdminReceiptsHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new GetAdminReceiptsQuery(propertyId, invoiceId));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

adminGroup.MapGet("/properties/{propertyId:guid}/receipts/{receiptId:guid}/pdf", (
    Guid propertyId,
    Guid receiptId,
    GetAdminReceiptPdfHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new GetAdminReceiptPdfQuery(propertyId, receiptId));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.File(result.Value!.Content, "application/pdf", result.Value.FileName);
});

adminGroup.MapGet("/properties/{propertyId:guid}/lease-intents", (
    Guid propertyId,
    string? status,
    int? page,
    int? pageSize,
    GetAdminLeaseIntentsHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new GetAdminLeaseIntentsQuery(propertyId, status, Page: page, PageSize: pageSize));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

adminGroup.MapPost("/properties/{propertyId:guid}/lease-intents/{intentId:guid}/approve", (
    Guid propertyId,
    Guid intentId,
    ApproveAdminLeaseIntentHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new ApproveAdminLeaseIntentCommand(propertyId, intentId));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

adminGroup.MapPost("/properties/{propertyId:guid}/lease-intents/{intentId:guid}/reject", (
    Guid propertyId,
    Guid intentId,
    ReasonRequest request,
    RejectAdminLeaseIntentHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new RejectAdminLeaseIntentCommand(propertyId, intentId, request));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

adminGroup.MapGet("/properties/{propertyId:guid}/analytics/occupancy", (
    Guid propertyId,
    DateOnly? from,
    DateOnly? to,
    GetAdminOccupancyReportHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new GetAdminOccupancyReportQuery(propertyId, from, to));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

adminGroup.MapGet("/properties/{propertyId:guid}/analytics/revpar", (
    Guid propertyId,
    DateOnly? from,
    DateOnly? to,
    GetAdminRevParReportHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new GetAdminRevParReportQuery(propertyId, from, to));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

adminGroup.MapGet("/properties/{propertyId:guid}/analytics/receivables-aging", (
    Guid propertyId,
    DateOnly? from,
    DateOnly? to,
    GetAdminAgingReportHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new GetAdminAgingReportQuery(propertyId, from, to));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

adminGroup.MapGet("/properties/{propertyId:guid}/analytics/cashier-shifts", (
    Guid propertyId,
    DateOnly? from,
    DateOnly? to,
    GetAdminCashierShiftSummaryReportHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new GetAdminCashierShiftSummaryReportQuery(propertyId, from, to));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

adminGroup.MapGet("/properties/{propertyId:guid}/analytics/deposits", (
    Guid propertyId,
    DateOnly? from,
    DateOnly? to,
    GetAdminDepositSummaryReportHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new GetAdminDepositSummaryReportQuery(propertyId, from, to));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

adminGroup.MapGet("/users/{userId:guid}", (
    Guid userId,
    GetAdminUserHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new GetAdminUserQuery(userId));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

adminGroup.MapPost("/users/{userId:guid}/deactivate", (
    Guid userId,
    ReasonRequest request,
    DeactivateAdminUserHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new DeactivateAdminUserCommand(userId, request));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

adminGroup.MapPost("/users/{userId:guid}/reactivate", (
    Guid userId,
    ReactivateAdminUserHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new ReactivateAdminUserCommand(userId));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

adminGroup.MapGet("/properties/{propertyId:guid}/units/{unitId:guid}", (
    Guid propertyId,
    Guid unitId,
    GetAdminUnitHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new GetAdminUnitQuery(propertyId, unitId));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

adminGroup.MapDelete("/properties/{propertyId:guid}/units/{unitId:guid}", (
    Guid propertyId,
    Guid unitId,
    DeleteAdminUnitHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new DeleteAdminUnitCommand(propertyId, unitId));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

adminGroup.MapPost("/properties/{propertyId:guid}/buildings", (
    Guid propertyId,
    UpsertBuildingRequest request,
    UpsertAdminBuildingHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new UpsertAdminBuildingCommand(propertyId, request));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

adminGroup.MapDelete("/properties/{propertyId:guid}/buildings/{buildingId:guid}", (
    Guid propertyId,
    Guid buildingId,
    DeleteAdminBuildingHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new DeleteAdminBuildingCommand(propertyId, buildingId));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

adminGroup.MapPost("/properties/{propertyId:guid}/floors", (
    Guid propertyId,
    UpsertFloorRequest request,
    UpsertAdminFloorHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new UpsertAdminFloorCommand(propertyId, request));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

adminGroup.MapDelete("/properties/{propertyId:guid}/floors/{floorId:guid}", (
    Guid propertyId,
    Guid floorId,
    DeleteAdminFloorHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new DeleteAdminFloorCommand(propertyId, floorId));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

adminGroup.MapPost("/properties/{propertyId:guid}/unit-types", (
    Guid propertyId,
    UpsertUnitTypeRequest request,
    UpsertAdminUnitTypeHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new UpsertAdminUnitTypeCommand(propertyId, request));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

adminGroup.MapDelete("/properties/{propertyId:guid}/unit-types/{unitTypeId:guid}", (
    Guid propertyId,
    Guid unitTypeId,
    DeleteAdminUnitTypeHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new DeleteAdminUnitTypeCommand(propertyId, unitTypeId));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

adminGroup.MapGet("/properties/{propertyId:guid}/rates/plans/{ratePlanId:guid}", (
    Guid propertyId,
    Guid ratePlanId,
    GetAdminRatePlanHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new GetAdminRatePlanQuery(propertyId, ratePlanId));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

adminGroup.MapDelete("/properties/{propertyId:guid}/rates/plans/{ratePlanId:guid}", (
    Guid propertyId,
    Guid ratePlanId,
    DeleteAdminRatePlanHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new DeleteAdminRatePlanCommand(propertyId, ratePlanId));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

adminGroup.MapGet("/properties/{propertyId:guid}/rates/utilities/{tariffId:guid}", (
    Guid propertyId,
    Guid tariffId,
    GetAdminUtilityTariffHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new GetAdminUtilityTariffQuery(propertyId, tariffId));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

adminGroup.MapDelete("/properties/{propertyId:guid}/rates/utilities/{tariffId:guid}", (
    Guid propertyId,
    Guid tariffId,
    DeleteAdminUtilityTariffHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new DeleteAdminUtilityTariffCommand(propertyId, tariffId));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

adminGroup.MapGet("/properties/{propertyId:guid}/rates/taxes/{taxProfileId:guid}", (
    Guid propertyId,
    Guid taxProfileId,
    GetAdminTaxProfileHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new GetAdminTaxProfileQuery(propertyId, taxProfileId));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

adminGroup.MapDelete("/properties/{propertyId:guid}/rates/taxes/{taxProfileId:guid}", (
    Guid propertyId,
    Guid taxProfileId,
    DeleteAdminTaxProfileHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new DeleteAdminTaxProfileCommand(propertyId, taxProfileId));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

adminGroup.MapGet("/properties/{propertyId:guid}/reservations/{reservationId:guid}", (
    Guid propertyId,
    Guid reservationId,
    GetAdminReservationHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new GetAdminReservationQuery(propertyId, reservationId));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

adminGroup.MapPut("/properties/{propertyId:guid}/reservations/{reservationId:guid}", (
    Guid propertyId,
    Guid reservationId,
    UpdateReservationRequest request,
    UpdateAdminReservationHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new UpdateAdminReservationCommand(propertyId, reservationId, request));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

adminGroup.MapDelete("/properties/{propertyId:guid}/reservations/{reservationId:guid}", (
    Guid propertyId,
    Guid reservationId,
    DeleteAdminReservationHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new DeleteAdminReservationCommand(propertyId, reservationId));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

adminGroup.MapGet("/properties/{propertyId:guid}/stays/{stayId:guid}", (
    Guid propertyId,
    Guid stayId,
    GetAdminStayHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new GetAdminStayQuery(propertyId, stayId));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

adminGroup.MapPut("/properties/{propertyId:guid}/stays/{stayId:guid}", (
    Guid propertyId,
    Guid stayId,
    UpdateStayRequest request,
    UpdateAdminStayHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new UpdateAdminStayCommand(propertyId, stayId, request));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

adminGroup.MapPost("/properties/{propertyId:guid}/stays/{stayId:guid}/cancel", (
    Guid propertyId,
    Guid stayId,
    ReasonRequest request,
    CancelAdminStayHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new CancelAdminStayCommand(propertyId, stayId, request));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

adminGroup.MapPost("/properties/{propertyId:guid}/stays/{stayId:guid}/occupants", (
    Guid propertyId,
    Guid stayId,
    CheckInOccupantInputDto request,
    AddAdminStayOccupantHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new AddAdminStayOccupantCommand(propertyId, stayId, request));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

adminGroup.MapPut("/properties/{propertyId:guid}/stays/{stayId:guid}/occupants/{occupantId:guid}", (
    Guid propertyId,
    Guid stayId,
    Guid occupantId,
    UpdateStayOccupantRequest request,
    UpdateAdminStayOccupantHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new UpdateAdminStayOccupantCommand(propertyId, stayId, occupantId, request));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

adminGroup.MapDelete("/properties/{propertyId:guid}/stays/{stayId:guid}/occupants/{occupantId:guid}", (
    Guid propertyId,
    Guid stayId,
    Guid occupantId,
    DeleteAdminStayOccupantHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new DeleteAdminStayOccupantCommand(propertyId, stayId, occupantId));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

adminGroup.MapPost("/properties/{propertyId:guid}/stays/{stayId:guid}/folio/charges/{chargeId:guid}/void", (
    Guid propertyId,
    Guid stayId,
    Guid chargeId,
    ReasonRequest request,
    VoidAdminFolioChargeHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new VoidAdminFolioChargeCommand(propertyId, stayId, chargeId, request));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

adminGroup.MapPost("/properties/{propertyId:guid}/stays/{stayId:guid}/folio/payments/reverse", (
    Guid propertyId,
    Guid stayId,
    ReverseFolioPaymentRequest request,
    ReverseAdminFolioPaymentHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new ReverseAdminFolioPaymentCommand(propertyId, stayId, request));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

authGroup.MapPost("/logout", (
    LogoutAuthSessionHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new LogoutAuthSessionCommand());
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.NoContent();
});

adminGroup.MapGet("/properties/{propertyId:guid}/billing-settings", (
    Guid propertyId,
    GetAdminBillingSettingsHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new GetAdminBillingSettingsQuery(propertyId));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

adminGroup.MapPut("/properties/{propertyId:guid}/billing-settings", (
    Guid propertyId,
    UpdateBillingSettingsRequest request,
    UpdateAdminBillingSettingsHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new UpdateAdminBillingSettingsCommand(propertyId, request));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

var clientGroup = app.MapGroup("/api/v1/client");

clientGroup.MapPost("/invoices/{invoiceId:guid}/slips", (
    Guid invoiceId,
    SubmitPaymentSlipRequest request,
    SubmitClientPaymentSlipHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new SubmitClientPaymentSlipCommand(invoiceId, request));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Created($"/api/v1/client/invoices/{invoiceId}/slips/{result.Value!.Id}", result.Value);
});

clientGroup.MapGet("/invoices/{invoiceId:guid}/slips", (
    Guid invoiceId,
    GetClientInvoiceSlipsHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new GetClientInvoiceSlipsQuery(invoiceId));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

clientGroup.MapGet("/work-orders", (
    string? status,
    int? page,
    int? pageSize,
    GetClientWorkOrdersHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new GetClientWorkOrdersQuery(status, Page: page, PageSize: pageSize));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

clientGroup.MapPost("/work-orders", (
    CreateWorkOrderRequest request,
    CreateClientWorkOrderHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new CreateClientWorkOrderCommand(request));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Created($"/api/v1/client/work-orders/{result.Value!.Id}", result.Value);
});

clientGroup.MapGet("/parcels", (
    string? status,
    int? page,
    int? pageSize,
    GetClientParcelsHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new GetClientParcelsQuery(status, Page: page, PageSize: pageSize));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

clientGroup.MapPut("/invoices/{invoiceId:guid}/slips/{slipId:guid}", (
    Guid invoiceId,
    Guid slipId,
    SubmitPaymentSlipRequest request,
    UpdateClientPaymentSlipHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new UpdateClientPaymentSlipCommand(invoiceId, slipId, request));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

clientGroup.MapDelete("/invoices/{invoiceId:guid}/slips/{slipId:guid}", (
    Guid invoiceId,
    Guid slipId,
    WithdrawClientPaymentSlipHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new WithdrawClientPaymentSlipCommand(invoiceId, slipId));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

clientGroup.MapGet("/work-orders/{workOrderId:guid}", (
    Guid workOrderId,
    GetClientWorkOrderHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new GetClientWorkOrderQuery(workOrderId));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

clientGroup.MapPut("/work-orders/{workOrderId:guid}", (
    Guid workOrderId,
    UpdateWorkOrderRequest request,
    UpdateClientWorkOrderHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new UpdateClientWorkOrderCommand(workOrderId, request));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

clientGroup.MapPost("/work-orders/{workOrderId:guid}/cancel", (
    Guid workOrderId,
    ReasonRequest request,
    CancelClientWorkOrderHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new CancelClientWorkOrderCommand(workOrderId, request));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

clientGroup.MapGet("/parcels/{parcelId:guid}", (
    Guid parcelId,
    GetClientParcelHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new GetClientParcelQuery(parcelId));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

clientGroup.MapPost("/files", (
    [FromForm] string purpose,
    IFormFile file,
    UploadClientFileHandler handler,
    HttpContext httpContext) =>
{
    using var content = file.OpenReadStream();
    var result = handler.Handle(new UploadClientFileCommand(purpose, content));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Created($"/api/v1/client/files/{result.Value!.FileKey}", result.Value);
}).DisableAntiforgery();

clientGroup.MapGet("/files/{**fileKey}", (
    string fileKey,
    GetClientFileHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new GetClientFileQuery(fileKey));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.File(result.Value!.Content, result.Value.ContentType, result.Value.FileKey);
});

clientGroup.MapGet("/receipts", (
    GetClientReceiptsHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new GetClientReceiptsQuery());
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

clientGroup.MapGet("/receipts/{receiptId:guid}/pdf", (
    Guid receiptId,
    GetClientReceiptPdfHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new GetClientReceiptPdfQuery(receiptId));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.File(result.Value!.Content, "application/pdf", result.Value.FileName);
});

clientGroup.MapGet("/leases", (
    GetClientLeasesHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new GetClientLeasesQuery());
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

clientGroup.MapGet("/leases/{leaseId:guid}", (
    Guid leaseId,
    GetClientLeaseHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new GetClientLeaseQuery(leaseId));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

clientGroup.MapPost("/leases/{leaseId:guid}/intents", (
    Guid leaseId,
    CreateLeaseIntentRequest request,
    CreateClientLeaseIntentHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new CreateClientLeaseIntentCommand(leaseId, request));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Created($"/api/v1/client/lease-intents/{result.Value!.Id}", result.Value);
});

clientGroup.MapGet("/lease-intents", (
    GetClientLeaseIntentsHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new GetClientLeaseIntentsQuery());
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

clientGroup.MapPut("/lease-intents/{intentId:guid}", (
    Guid intentId,
    UpdateLeaseIntentRequest request,
    UpdateClientLeaseIntentHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new UpdateClientLeaseIntentCommand(intentId, request));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

clientGroup.MapDelete("/lease-intents/{intentId:guid}", (
    Guid intentId,
    WithdrawClientLeaseIntentHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new WithdrawClientLeaseIntentCommand(intentId));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

clientGroup.MapGet("/invoices", (
    string? status,
    int? page,
    int? pageSize,
    GetClientInvoicesHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new GetClientInvoicesQuery(status, Page: page, PageSize: pageSize));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

clientGroup.MapGet("/invoices/{invoiceId:guid}", (
    Guid invoiceId,
    GetClientInvoiceHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new GetClientInvoiceQuery(invoiceId));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

clientGroup.MapGet("/utility-usage", (
    Guid? leaseId,
    int? months,
    GetClientUtilityUsageHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new GetClientUtilityUsageQuery(leaseId, months));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

clientGroup.MapGet("/payment-slips", (
    int? page,
    int? pageSize,
    GetClientPaymentSlipsHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new GetClientPaymentSlipsQuery(Page: page, PageSize: pageSize));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

clientGroup.MapGet("/reservations/{reservationId:guid}", (
    Guid reservationId,
    GetClientReservationHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new GetClientReservationQuery(reservationId));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

clientGroup.MapPost("/reservations/{reservationId:guid}/cancel", (
    Guid reservationId,
    ReasonRequest request,
    CancelClientReservationHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new CancelClientReservationCommand(reservationId, request));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

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
    int? page,
    int? pageSize,
    GetClientNotificationsHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new GetClientNotificationsQuery(Page: page, PageSize: pageSize));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

clientGroup.MapGet("/availability", (
    Guid propertyId,
    string stayMode,
    DateTimeOffset slotStartAt,
    DateTimeOffset slotEndAt,
    GetClientAvailabilityHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new GetClientAvailabilityQuery(
        propertyId,
        stayMode,
        slotStartAt,
        slotEndAt));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

clientGroup.MapGet("/reservations", (
    int? page,
    int? pageSize,
    GetClientReservationsHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new GetClientReservationsQuery(Page: page, PageSize: pageSize));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

clientGroup.MapPost("/reservations/hold", (
    CreateClientHoldReservationRequest request,
    CreateClientHoldReservationHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new CreateClientHoldReservationCommand(request));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Created($"/api/v1/client/reservations/{result.Value!.Id}", result.Value);
});

clientGroup.MapPost("/reservations/{reservationId:guid}/slip", (
    Guid reservationId,
    SubmitReservationSlipRequest request,
    SubmitClientReservationSlipHandler handler,
    HttpContext httpContext) =>
{
    var result = handler.Handle(new SubmitClientReservationSlipCommand(reservationId, request));
    return result.IsFailure
        ? ProblemDetailsMapper.ToProblemResult(result.Error, httpContext)
        : Results.Ok(result.Value);
});

if (app.Environment.IsDevelopment())
{
    await PmsDatabaseInitializer.InitializeIfPostgresAsync(
        app.Services,
        app.Configuration,
        app.Logger);
}

app.Run();

public partial class Program;
