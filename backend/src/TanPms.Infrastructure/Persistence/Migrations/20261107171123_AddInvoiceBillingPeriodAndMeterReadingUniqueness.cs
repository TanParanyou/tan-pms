using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TanPms.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddInvoiceBillingPeriodAndMeterReadingUniqueness : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "BillingPeriodYearMonth",
                table: "MeterReadings",
                type: "character varying(7)",
                maxLength: 7,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.AddColumn<string>(
                name: "BillingPeriodYearMonth",
                table: "Invoices",
                type: "character varying(7)",
                maxLength: 7,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_MeterReadings_UnitId_UtilityType_BillingPeriodYearMonth",
                table: "MeterReadings",
                columns: new[] { "UnitId", "UtilityType", "BillingPeriodYearMonth" },
                unique: true,
                filter: "\"IsDeleted\" = false");

            migrationBuilder.CreateIndex(
                name: "IX_Invoices_LeaseId_BillingPeriodYearMonth",
                table: "Invoices",
                columns: new[] { "LeaseId", "BillingPeriodYearMonth" },
                unique: true,
                filter: "\"IsDeleted\" = false AND \"Status\" <> 6 AND \"LeaseId\" IS NOT NULL AND \"BillingPeriodYearMonth\" IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_MeterReadings_UnitId_UtilityType_BillingPeriodYearMonth",
                table: "MeterReadings");

            migrationBuilder.DropIndex(
                name: "IX_Invoices_LeaseId_BillingPeriodYearMonth",
                table: "Invoices");

            migrationBuilder.DropColumn(
                name: "BillingPeriodYearMonth",
                table: "Invoices");

            migrationBuilder.AlterColumn<string>(
                name: "BillingPeriodYearMonth",
                table: "MeterReadings",
                type: "text",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(7)",
                oldMaxLength: 7);
        }
    }
}
