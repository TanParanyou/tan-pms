using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TanPms.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddDueDatesReceiptsForStaysAndPaymentMethods : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<Guid>(
                name: "InvoiceId",
                table: "Receipts",
                type: "uuid",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uuid");

            migrationBuilder.AddColumn<string>(
                name: "CashierUserId",
                table: "Receipts",
                type: "character varying(128)",
                maxLength: 128,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PaymentMethod",
                table: "Receipts",
                type: "character varying(16)",
                maxLength: 16,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "StayId",
                table: "Receipts",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "PaymentTermsDays",
                table: "Properties",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<DateOnly>(
                name: "DueDate",
                table: "Invoices",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "OverdueNotifiedAt",
                table: "Invoices",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PaymentMethod",
                table: "DepositTransactions",
                type: "character varying(16)",
                maxLength: 16,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Receipts_StayId",
                table: "Receipts",
                column: "StayId");

            migrationBuilder.CreateIndex(
                name: "IX_Invoices_Status_DueDate",
                table: "Invoices",
                columns: new[] { "Status", "DueDate" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Receipts_StayId",
                table: "Receipts");

            migrationBuilder.DropIndex(
                name: "IX_Invoices_Status_DueDate",
                table: "Invoices");

            migrationBuilder.DropColumn(
                name: "CashierUserId",
                table: "Receipts");

            migrationBuilder.DropColumn(
                name: "PaymentMethod",
                table: "Receipts");

            migrationBuilder.DropColumn(
                name: "StayId",
                table: "Receipts");

            migrationBuilder.DropColumn(
                name: "PaymentTermsDays",
                table: "Properties");

            migrationBuilder.DropColumn(
                name: "DueDate",
                table: "Invoices");

            migrationBuilder.DropColumn(
                name: "OverdueNotifiedAt",
                table: "Invoices");

            migrationBuilder.DropColumn(
                name: "PaymentMethod",
                table: "DepositTransactions");

            migrationBuilder.AlterColumn<Guid>(
                name: "InvoiceId",
                table: "Receipts",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);
        }
    }
}
