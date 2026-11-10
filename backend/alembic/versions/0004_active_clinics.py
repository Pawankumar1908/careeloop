"""End clinic trial statuses and activate existing trial accounts."""
from alembic import op


revision = "0004_active_clinics"
down_revision = "0003_medication_reminders"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("UPDATE clinics SET status = 'active' WHERE status = 'trial'")


def downgrade():
    pass
