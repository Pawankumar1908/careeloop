"""Add clinic member phone login and presence fields."""
from alembic import op
import sqlalchemy as sa


revision = "0005_clinic_members"
down_revision = "0004_active_clinics"
branch_labels = None
depends_on = None


def upgrade():
    op.alter_column("clinic_users", "email", existing_type=sa.String(length=320), nullable=True)
    op.add_column("clinic_users", sa.Column("phone_e164", sa.String(length=16), nullable=True))
    op.add_column("clinic_users", sa.Column("designation", sa.String(length=80), nullable=True))
    op.add_column("clinic_users", sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=True))
    op.create_unique_constraint("uq_clinic_users_phone_e164", "clinic_users", ["phone_e164"])


def downgrade():
    op.execute("UPDATE clinic_users SET email = phone_e164 || '@phone.local' WHERE email IS NULL AND phone_e164 IS NOT NULL")
    op.drop_constraint("uq_clinic_users_phone_e164", "clinic_users", type_="unique")
    op.drop_column("clinic_users", "last_seen_at")
    op.drop_column("clinic_users", "designation")
    op.drop_column("clinic_users", "phone_e164")
    op.alter_column("clinic_users", "email", existing_type=sa.String(length=320), nullable=False)
