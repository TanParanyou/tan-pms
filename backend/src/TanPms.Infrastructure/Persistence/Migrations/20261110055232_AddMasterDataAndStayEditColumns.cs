using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TanPms.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddMasterDataAndStayEditColumns : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CancelReason",
                table: "Stays",
                type: "character varying(2000)",
                maxLength: 2000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Note",
                table: "Stays",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "GuestCount",
                table: "Reservations",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Note",
                table: "Reservations",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "IdentityDocumentFileKey",
                table: "Occupants",
                type: "character varying(32)",
                maxLength: 32,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PhoneNumber",
                table: "Occupants",
                type: "character varying(32)",
                maxLength: 32,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsVoided",
                table: "FolioCharge",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "VoidReason",
                table: "FolioCharge",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CancelReason",
                table: "Stays");

            migrationBuilder.DropColumn(
                name: "Note",
                table: "Stays");

            migrationBuilder.DropColumn(
                name: "GuestCount",
                table: "Reservations");

            migrationBuilder.DropColumn(
                name: "Note",
                table: "Reservations");

            migrationBuilder.DropColumn(
                name: "IdentityDocumentFileKey",
                table: "Occupants");

            migrationBuilder.DropColumn(
                name: "PhoneNumber",
                table: "Occupants");

            migrationBuilder.DropColumn(
                name: "IsVoided",
                table: "FolioCharge");

            migrationBuilder.DropColumn(
                name: "VoidReason",
                table: "FolioCharge");
        }
    }
}
