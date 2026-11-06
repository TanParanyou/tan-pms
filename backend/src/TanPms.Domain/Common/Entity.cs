namespace TanPms.Domain.Common;

public abstract class Entity
{
    public Guid Id { get; init; } = Guid.CreateVersion7();

    protected Entity(Guid id)
    {
        Id = id;
    }

    protected Entity()
    {
    }
}
