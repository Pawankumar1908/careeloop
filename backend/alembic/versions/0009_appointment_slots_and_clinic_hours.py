"""Add clinic hours and appointment slot durations."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "0009_appointment_slots"
down_revision = "0008_patient_demographics"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("clinics", sa.Column("opening_time", sa.String(length=5), nullable=False, server_default="08:00"))
    op.add_column("clinics", sa.Column("closing_time", sa.String(length=5), nullable=False, server_default="20:00"))
    op.add_column("clinic_appointments", sa.Column("duration_minutes", sa.Integer(), nullable=False, server_default="15"))
    op.create_table(
        "clinic_appointment_days",
        sa.Column("clinic_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("clinics.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("local_date", sa.Date(), primary_key=True),
        sa.Column("slots_per_hour", sa.Integer(), nullable=False, server_default="4"),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )


def downgrade():
    op.drop_table("clinic_appointment_days")
    op.drop_column("clinic_appointments", "duration_minutes")
    op.drop_column("clinics", "closing_time")
    op.drop_column("clinics", "opening_time")
