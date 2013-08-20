"""Add bodyweight

Revision ID: 1f25b9c02be3
Revises: None
Create Date: 2013-08-21 10:50:07.717541

"""

# revision identifiers, used by Alembic.
revision = '1f25b9c02be3'
down_revision = None

from alembic import op
import sqlalchemy as sa


def upgrade():
    op.add_column("workouts", sa.Column("bodyweight", sa.Float))


def downgrade():
    op.drop_column("workouts", "bodyweight")
