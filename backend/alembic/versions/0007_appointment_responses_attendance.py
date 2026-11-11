"""Track appointment confirmations and attendance."""
from alembic import op
import sqlalchemy as sa


revision = "0007_appt_responses"
down_revision = "0006_clinic_appointments"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("clinic_appointments", sa.Column("confirmation_status", sa.String(length=24), nullable=False, server_default="not_requested"))
    op.add_column("clinic_appointments", sa.Column("confirmation_message_id", sa.String(length=255), nullable=True))
    op.add_column("clinic_appointments", sa.Column("confirmation_responded_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("clinic_appointments", sa.Column("attendance_status", sa.String(length=24), nullable=False, server_default="unmarked"))
    op.create_unique_constraint("uq_clinic_appointments_confirmation_message_id", "clinic_appointments", ["confirmation_message_id"])


def downgrade():
    op.drop_constraint("uq_clinic_appointments_confirmation_message_id", "clinic_appointments", type_="unique")
    op.drop_column("clinic_appointments", "attendance_status")
    op.drop_column("clinic_appointments", "confirmation_responded_at")
    op.drop_column("clinic_appointments", "confirmation_message_id")
    op.drop_column("clinic_appointments", "confirmation_status")
