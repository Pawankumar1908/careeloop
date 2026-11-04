"""Phase 1 tenant and authentication foundation."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0001_phase1"
down_revision = None
branch_labels = None
depends_on = None
role_enum = sa.Enum("platform_admin", "clinic_admin", "doctor", "staff", name="role", native_enum=False)

def upgrade():
    op.create_table("clinics", sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True), sa.Column("name", sa.String(200), nullable=False), sa.Column("timezone", sa.String(64), nullable=False), sa.Column("status", sa.String(24), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), nullable=False))
    op.create_table("clinic_users", sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True), sa.Column("clinic_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("clinics.id", ondelete="CASCADE")), sa.Column("name", sa.String(160), nullable=False), sa.Column("email", sa.String(320), nullable=False), sa.Column("password_hash", sa.String(255), nullable=False), sa.Column("role", role_enum, nullable=False), sa.Column("is_active", sa.Boolean(), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), nullable=False), sa.UniqueConstraint("email", name="uq_clinic_user_email"))
    op.create_index("ix_clinic_users_clinic_id", "clinic_users", ["clinic_id"])
    op.create_index("ix_clinic_users_email", "clinic_users", ["email"])
    op.create_table("patients", sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True), sa.Column("clinic_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("clinics.id", ondelete="CASCADE"), nullable=False), sa.Column("name", sa.String(160), nullable=False), sa.Column("phone_e164", sa.String(16), nullable=False), sa.Column("preferred_language", sa.String(16), nullable=False), sa.Column("consent_status", sa.String(16), nullable=False), sa.Column("consent_source", sa.String(100)), sa.Column("consent_at", sa.DateTime(timezone=True)), sa.Column("is_active", sa.Boolean(), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), nullable=False), sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False), sa.UniqueConstraint("clinic_id", "phone_e164", name="uq_patient_clinic_phone"))
    op.create_index("ix_patients_clinic_id", "patients", ["clinic_id"])
    op.create_index("ix_patient_clinic_name", "patients", ["clinic_id", "name"])
    op.create_table("refresh_sessions", sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True), sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("clinic_users.id", ondelete="CASCADE"), nullable=False), sa.Column("token_hash", sa.String(64), nullable=False), sa.Column("family_id", postgresql.UUID(as_uuid=True), nullable=False), sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False), sa.Column("revoked_at", sa.DateTime(timezone=True)), sa.Column("created_at", sa.DateTime(timezone=True), nullable=False), sa.UniqueConstraint("token_hash"))
    op.create_index("ix_refresh_sessions_user_id", "refresh_sessions", ["user_id"])
    op.create_index("ix_refresh_sessions_family_id", "refresh_sessions", ["family_id"])

def downgrade():
    op.drop_table("refresh_sessions")
    op.drop_table("patients")
    op.drop_table("clinic_users")
    op.drop_table("clinics")
