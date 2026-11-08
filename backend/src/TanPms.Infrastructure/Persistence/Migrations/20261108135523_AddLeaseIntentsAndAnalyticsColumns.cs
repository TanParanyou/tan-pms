using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TanPms.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddLeaseIntentsAndAnalyticsColumns : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "IssuedAt",
                table: "Invoices",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ChargeCategoryCode",
                table: "FolioCharge",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "LeaseIntentRequests",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PropertyId = table.Column<Guid>(type: "uuid", nullable: false),
                    LeaseId = table.Column<Guid>(type: "uuid", nullable: false),
                    CustomerId = table.Column<Guid>(type: "uuid", nullable: false),
                    IntentType = table.Column<int>(type: "integer", nullable: false),
                    DesiredDate = table.Column<DateOnly>(type: "date", nullable: false),
                    Note = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    ReviewedByUserId = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    ReviewedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    RejectReason = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
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
                    table.PrimaryKey("PK_LeaseIntentRequests", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_LeaseIntentRequests_CustomerId",
                table: "LeaseIntentRequests",
                column: "CustomerId");

            migrationBuilder.CreateIndex(
                name: "IX_LeaseIntentRequests_LeaseId",
                table: "LeaseIntentRequests",
                column: "LeaseId",
                unique: true,
                filter: "\"IsDeleted\" = false AND \"Status\" = 1");

            migrationBuilder.CreateIndex(
                name: "IX_LeaseIntentRequests_PropertyId_Status",
                table: "LeaseIntentRequests",
                columns: new[] { "PropertyId", "Status" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "LeaseIntentRequests");

            migrationBuilder.DropColumn(
                name: "IssuedAt",
                table: "Invoices");

            migrationBuilder.DropColumn(
                name: "ChargeCategoryCode",
                table: "FolioCharge");
        }
    }
}
