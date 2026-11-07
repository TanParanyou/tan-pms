using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TanPms.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddDocumentSequencesAndSlotExclusionConstraints : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_FolioCharge_Folios_FolioId",
                table: "FolioCharge");

            migrationBuilder.DropForeignKey(
                name: "FK_InvoiceLine_Invoices_InvoiceId",
                table: "InvoiceLine");

            migrationBuilder.AddColumn<string>(
                name: "CancellationReason",
                table: "Reservations",
                type: "text",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "document_sequences",
                columns: table => new
                {
                    property_id = table.Column<Guid>(type: "uuid", nullable: false),
                    document_type = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    period_yymm = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                    last_sequence = table.Column<int>(type: "integer", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_document_sequences", x => new { x.property_id, x.document_type, x.period_yymm });
                });

            migrationBuilder.AddForeignKey(
                name: "FK_FolioCharge_Folios_FolioId",
                table: "FolioCharge",
                column: "FolioId",
                principalTable: "Folios",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_InvoiceLine_Invoices_InvoiceId",
                table: "InvoiceLine",
                column: "InvoiceId",
                principalTable: "Invoices",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.Sql("CREATE EXTENSION IF NOT EXISTS btree_gist;");

            migrationBuilder.Sql("""
                ALTER TABLE "Reservations"
                ADD CONSTRAINT "EXCL_Reservations_UnitId_SlotRange"
                EXCLUDE USING gist (
                    "UnitId" WITH =,
                    tstzrange("SlotStartAt", "SlotEndAt", '[)') WITH &&
                )
                WHERE (NOT "IsDeleted" AND "UnitId" IS NOT NULL AND "Status" IN (0, 1, 2, 3, 4));
                """);

            migrationBuilder.Sql("""
                ALTER TABLE "Stays"
                ADD CONSTRAINT "EXCL_Stays_UnitId_ActiveSlotRange"
                EXCLUDE USING gist (
                    "UnitId" WITH =,
                    tstzrange("CheckInAt", "ExpectedCheckOutAt", '[)') WITH &&
                )
                WHERE (NOT "IsDeleted" AND "Status" IN (0, 1));
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""ALTER TABLE "Stays" DROP CONSTRAINT IF EXISTS "EXCL_Stays_UnitId_ActiveSlotRange";""");
            migrationBuilder.Sql("""ALTER TABLE "Reservations" DROP CONSTRAINT IF EXISTS "EXCL_Reservations_UnitId_SlotRange";""");

            migrationBuilder.DropForeignKey(
                name: "FK_FolioCharge_Folios_FolioId",
                table: "FolioCharge");

            migrationBuilder.DropForeignKey(
                name: "FK_InvoiceLine_Invoices_InvoiceId",
                table: "InvoiceLine");

            migrationBuilder.DropTable(
                name: "document_sequences");

            migrationBuilder.DropColumn(
                name: "CancellationReason",
                table: "Reservations");

            migrationBuilder.AddForeignKey(
                name: "FK_FolioCharge_Folios_FolioId",
                table: "FolioCharge",
                column: "FolioId",
                principalTable: "Folios",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_InvoiceLine_Invoices_InvoiceId",
                table: "InvoiceLine",
                column: "InvoiceId",
                principalTable: "Invoices",
                principalColumn: "Id");
        }
    }
}
