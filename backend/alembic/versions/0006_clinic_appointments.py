"""Add clinic-scoped patient appointments."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "0006_clinic_appointments"
down_revision = "0005_clinic_members"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "clinic_appointments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("clinic_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("clinics.id", ondelete="CASCADE"), nullable=False),
        sa.Column("patient_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("patients.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(length=160), nullable=False),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=24), nullable=False),
        sa.Column("reminder_minutes_before", sa.Integer(), nullable=True),
        sa.Column("reminder_status", sa.String(length=24), nullable=False),
        sa.Column("reminder_sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("reminder_message_id", sa.String(length=255), nullable=True),
        sa.Column("reminder_error", sa.Text(), nullable=True),
        sa.Column("created_by_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("clinic_users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("reminder_message_id", name="uq_clinic_appointments_reminder_message_id"),
    )
    op.create_index("ix_clinic_appointments_clinic_id", "clinic_appointments", ["clinic_id"])
    op.create_index("ix_clinic_appointments_patient_id", "clinic_appointments", ["patient_id"])
    op.create_index("ix_clinic_appointments_clinic_starts", "clinic_appointments", ["clinic_id", "starts_at"])


def downgrade():
    op.drop_table("clinic_appointments")
