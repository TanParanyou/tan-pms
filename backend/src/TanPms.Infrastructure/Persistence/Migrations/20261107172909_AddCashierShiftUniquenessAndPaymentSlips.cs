using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TanPms.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddCashierShiftUniquenessAndPaymentSlips : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "PaymentSlipId",
                table: "Receipts",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "PaymentSlips",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PropertyId = table.Column<Guid>(type: "uuid", nullable: false),
                    InvoiceId = table.Column<Guid>(type: "uuid", nullable: false),
                    CustomerId = table.Column<Guid>(type: "uuid", nullable: false),
                    Amount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    TransferReference = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    TransferredAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    SlipFileKey = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    ReviewedByUserId = table.Column<string>(type: "text", nullable: true),
                    ReviewedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    RejectReason = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PaymentSlips", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Receipts_InvoiceId",
                table: "Receipts",
                column: "InvoiceId");

            migrationBuilder.CreateIndex(
                name: "IX_Receipts_PaymentSlipId",
                table: "Receipts",
                column: "PaymentSlipId",
                unique: true,
                filter: "\"IsDeleted\" = false AND \"PaymentSlipId\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_CashierShifts_PropertyId_CashierUserId",
                table: "CashierShifts",
                columns: new[] { "PropertyId", "CashierUserId" },
                unique: true,
                filter: "\"IsDeleted\" = false AND \"Status\" = 1");

            migrationBuilder.CreateIndex(
                name: "IX_PaymentSlips_InvoiceId",
                table: "PaymentSlips",
                column: "InvoiceId");

            migrationBuilder.CreateIndex(
                name: "IX_PaymentSlips_PropertyId_Status",
                table: "PaymentSlips",
                columns: new[] { "PropertyId", "Status" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PaymentSlips");

            migrationBuilder.DropIndex(
                name: "IX_Receipts_InvoiceId",
                table: "Receipts");

            migrationBuilder.DropIndex(
                name: "IX_Receipts_PaymentSlipId",
                table: "Receipts");

            migrationBuilder.DropIndex(
                name: "IX_CashierShifts_PropertyId_CashierUserId",
                table: "CashierShifts");

            migrationBuilder.DropColumn(
                name: "PaymentSlipId",
                table: "Receipts");
        }
    }
}
