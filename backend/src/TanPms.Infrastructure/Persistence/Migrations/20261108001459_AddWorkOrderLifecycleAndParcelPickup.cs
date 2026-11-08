using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TanPms.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddWorkOrderLifecycleAndParcelPickup : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "IssueSummary",
                table: "WorkOrders",
                type: "character varying(200)",
                maxLength: 200,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.AddColumn<string>(
                name: "AssignedTechnicianUserId",
                table: "WorkOrders",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ChargeDocumentNumber",
                table: "WorkOrders",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Description",
                table: "WorkOrders",
                type: "character varying(2000)",
                maxLength: 2000,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Priority",
                table: "WorkOrders",
                type: "integer",
                nullable: false,
                defaultValue: 2); // WorkOrderPriority.Normal for existing rows

            migrationBuilder.AddColumn<string>(
                name: "ResolutionNotes",
                table: "WorkOrders",
                type: "character varying(2000)",
                maxLength: 2000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RecipientName",
                table: "Parcels",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_WorkOrders_PropertyId_Status",
                table: "WorkOrders",
                columns: new[] { "PropertyId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_WorkOrders_ReportedByCustomerId",
                table: "WorkOrders",
                column: "ReportedByCustomerId");

            migrationBuilder.CreateIndex(
                name: "IX_Parcels_CustomerId",
                table: "Parcels",
                column: "CustomerId");

            migrationBuilder.CreateIndex(
                name: "IX_Parcels_PropertyId_Status",
                table: "Parcels",
                columns: new[] { "PropertyId", "Status" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_WorkOrders_PropertyId_Status",
                table: "WorkOrders");

            migrationBuilder.DropIndex(
                name: "IX_WorkOrders_ReportedByCustomerId",
                table: "WorkOrders");

            migrationBuilder.DropIndex(
                name: "IX_Parcels_CustomerId",
                table: "Parcels");

            migrationBuilder.DropIndex(
                name: "IX_Parcels_PropertyId_Status",
                table: "Parcels");

            migrationBuilder.DropColumn(
                name: "AssignedTechnicianUserId",
                table: "WorkOrders");

            migrationBuilder.DropColumn(
                name: "ChargeDocumentNumber",
                table: "WorkOrders");

            migrationBuilder.DropColumn(
                name: "Description",
                table: "WorkOrders");

            migrationBuilder.DropColumn(
                name: "Priority",
                table: "WorkOrders");

            migrationBuilder.DropColumn(
                name: "ResolutionNotes",
                table: "WorkOrders");

            migrationBuilder.DropColumn(
                name: "RecipientName",
                table: "Parcels");

            migrationBuilder.AlterColumn<string>(
                name: "IssueSummary",
                table: "WorkOrders",
                type: "text",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(200)",
                oldMaxLength: 200);
        }
    }
}
