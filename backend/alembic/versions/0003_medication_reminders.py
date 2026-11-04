"""Add clinic-scoped medication schedules and reminder response records."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "0003_medication_reminders"
down_revision = "0002_whatsapp_connections"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "medication_schedules",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("clinic_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("clinics.id", ondelete="CASCADE"), nullable=False),
        sa.Column("patient_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("patients.id", ondelete="CASCADE"), nullable=False),
        sa.Column("medicine_name", sa.String(200), nullable=False),
        sa.Column("frequency", sa.String(80), nullable=False),
        sa.Column("food_timing", sa.String(80), nullable=False),
        sa.Column("duration_days", sa.Integer(), nullable=False),
        sa.Column("reminder_times", sa.JSON(), nullable=False),
        sa.Column("starts_on", sa.Date(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_medication_schedules_clinic_id", "medication_schedules", ["clinic_id"])
    op.create_index("ix_medication_schedules_patient_id", "medication_schedules", ["patient_id"])
    op.create_table(
        "medication_reminders",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("clinic_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("clinics.id", ondelete="CASCADE"), nullable=False),
        sa.Column("patient_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("patients.id", ondelete="CASCADE"), nullable=False),
        sa.Column("schedule_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("medication_schedules.id", ondelete="CASCADE"), nullable=False),
        sa.Column("medicine_name", sa.String(200), nullable=False),
        sa.Column("scheduled_for", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", sa.String(24), nullable=False),
        sa.Column("whatsapp_message_id", sa.String(255), nullable=True),
        sa.Column("responded_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("schedule_id", "scheduled_for", name="uq_medication_reminder_schedule_time"),
        sa.UniqueConstraint("whatsapp_message_id", name="uq_medication_reminder_message_id"),
    )
    op.create_index("ix_medication_reminders_clinic_id", "medication_reminders", ["clinic_id"])
    op.create_index("ix_medication_reminders_patient_id", "medication_reminders", ["patient_id"])
    op.create_index("ix_medication_reminders_schedule_id", "medication_reminders", ["schedule_id"])
    op.create_index("ix_medication_reminder_due", "medication_reminders", ["status", "scheduled_for"])


def downgrade():
    op.drop_table("medication_reminders")
    op.drop_table("medication_schedules")
