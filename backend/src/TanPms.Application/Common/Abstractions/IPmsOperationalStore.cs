using TanPms.Application.Billing;
using TanPms.Application.Cashier;
using TanPms.Application.Client;
using TanPms.Application.Customers;
using TanPms.Application.Identity;
using TanPms.Application.Leases;
using TanPms.Application.Meters;
using TanPms.Application.Notifications;
using TanPms.Application.Payments;
using TanPms.Application.Properties;
using TanPms.Application.Rack;
using TanPms.Application.Rates;
using TanPms.Application.Reservations;
using TanPms.Application.Stays;

namespace TanPms.Application.Common.Abstractions;

public interface IPmsOperationalStore
    : IIdentityStore,
      INotificationStore,
      IPropertyCatalogStore,
      IRateCatalogStore,
      IReservationStore,
      IStayStore,
      ILeaseStore,
      ICustomerStore,
      IMeterReadingStore,
      IBillingStore,
      ICashierShiftStore,
      IDepositLedgerStore,
      IPaymentSlipStore,
      IRoomRackStore,
      IClientDashboardStore;
