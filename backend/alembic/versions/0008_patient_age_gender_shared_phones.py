"""Support patient demographics and shared household phone numbers."""
from alembic import op
import sqlalchemy as sa


revision = "0008_patient_demographics"
down_revision = "0007_appt_responses"
branch_labels = None
depends_on = None


def upgrade():
    op.drop_constraint("uq_patient_clinic_phone", "patients", type_="unique")
    op.add_column("patients", sa.Column("age", sa.Integer(), nullable=True))
    op.add_column("patients", sa.Column("gender", sa.String(length=32), nullable=True))
    op.create_index("ix_patient_clinic_phone", "patients", ["clinic_id", "phone_e164"])
    op.create_index("uq_patient_clinic_name_phone", "patients", ["clinic_id", sa.text("lower(trim(name))"), "phone_e164"], unique=True)


def downgrade():
    op.drop_index("uq_patient_clinic_name_phone", table_name="patients")
    op.drop_index("ix_patient_clinic_phone", table_name="patients")
    op.drop_column("patients", "gender")
    op.drop_column("patients", "age")
    op.create_unique_constraint("uq_patient_clinic_phone", "patients", ["clinic_id", "phone_e164"])
