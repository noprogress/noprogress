#!/usr/bin/env python

from noprogress import db, models
import logging

logging.basicConfig()
logging.getLogger("sqlalchemy.engine").setLevel(logging.INFO)

db.create_all()

for lift in ["squat", "front_squat", "bench_press", "overhead_press", "deadlift", "power_clean"]:
    db.session.add(models.LiftType(name=lift))

db.session.commit()
