using System.Data;
using Dapper;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using TanPms.Application.Common.Abstractions;
using TanPms.Domain.Common;
using TanPms.Domain.DocumentNumbering;
using TanPms.Infrastructure.Persistence;

namespace TanPms.Infrastructure.Services;

public sealed class PostgresDocumentNumberService : IDocumentNumberService
{
    private const string AtomicUpsertSql = """
        INSERT INTO document_sequences (property_id, document_type, period_yymm, last_sequence, updated_at)
        VALUES (@PropertyId, @DocumentType, @PeriodYyMm, 1, clock_timestamp())
        ON CONFLICT (property_id, document_type, period_yymm)
        DO UPDATE SET
            last_sequence = document_sequences.last_sequence + 1,
            updated_at = clock_timestamp()
        RETURNING last_sequence;
        """;

    private readonly TanPmsDbContext _dbContext;

    public PostgresDocumentNumberService(TanPmsDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<string> NextDocumentNumberAsync(
        Guid propertyId,
        string propertyCode,
        DocumentTypeCode documentType,
        DateTimeOffset issuedAtUtc,
        CancellationToken cancellationToken = default)
    {
        if (propertyId == Guid.Empty)
        {
            throw new DomainRuleException(DomainErrorCodes.ValidationFailed, "PropertyId is required.", 400);
        }

        if (!Enum.IsDefined(documentType))
        {
            throw new DomainRuleException(DomainErrorCodes.ValidationFailed, $"Unsupported DocumentTypeCode '{documentType}'.", 400);
        }

        var utcInstant = issuedAtUtc.ToUniversalTime();
        var year = utcInstant.Year;
        var month = utcInstant.Month;
        var periodYyMm = $"{year % 100:00}{month:00}";

        var connection = _dbContext.Database.GetDbConnection();
        var shouldCloseConnection = connection.State != ConnectionState.Open;
        if (shouldCloseConnection)
        {
            await _dbContext.Database.OpenConnectionAsync(cancellationToken);
        }

        try
        {
            var currentTransaction = _dbContext.Database.CurrentTransaction?.GetDbTransaction();
            var command = new CommandDefinition(
                commandText: AtomicUpsertSql,
                parameters: new
                {
                    PropertyId = propertyId,
                    DocumentType = documentType.ToString(),
                    PeriodYyMm = periodYyMm
                },
                transaction: currentTransaction,
                cancellationToken: cancellationToken);

            var nextSequence = await connection.ExecuteScalarAsync<int>(command);
            return DocumentNumberFormatter.Format(
                propertyCode: propertyCode,
                documentType: documentType,
                year: year,
                month: month,
                sequenceNumber: nextSequence);
        }
        finally
        {
            if (shouldCloseConnection)
            {
                await _dbContext.Database.CloseConnectionAsync();
            }
        }
    }
}
