"""Store a WhatsApp Cloud API connection per clinic."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "0002_whatsapp_connections"
down_revision = "0001_phase1"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "whatsapp_connections",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("clinic_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("clinics.id", ondelete="CASCADE"), nullable=False),
        sa.Column("business_account_id", sa.String(80), nullable=False),
        sa.Column("phone_number_id", sa.String(80), nullable=False),
        sa.Column("display_phone_number", sa.String(40), nullable=True),
        sa.Column("verified_name", sa.String(200), nullable=True),
        sa.Column("encrypted_access_token", sa.Text(), nullable=False),
        sa.Column("connected_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("clinic_id", name="uq_whatsapp_connection_clinic"),
        sa.UniqueConstraint("phone_number_id", name="uq_whatsapp_connection_phone"),
    )


def downgrade():
    op.drop_table("whatsapp_connections")
