import datetime
import flask
from sqlalchemy.orm.exc import NoResultFound, MultipleResultsFound
from sqlalchemy.sql.expression import asc

from . import app, db


class IdMixin(object):
    """
    A mixin for entities that want a primary key.
    """
    id = db.Column(db.Integer, primary_key=True)

    @classmethod
    def by_id(cls, id):
        """
        Retrieve an entity by its primary key.
        """
        try:
            return db.session.query(cls).filter(cls.id == id).one()
        except (NoResultFound, MultipleResultsFound):
            return None


class User(db.Model, IdMixin):
    __tablename__ = "users"

    email = db.Column(db.String, unique=True, nullable=False)

    @classmethod
    def by_email(cls, email):
        """
        Retrieve a user by his email.
        """
        try:
            return db.session.query(cls).filter(cls.email == email).one()
        except (NoResultFound, MultipleResultsFound):
            return None

    @classmethod
    def current_identity(cls):
        email = flask.session.get("identity_email")
        if email is None:
            return None
        return cls.by_email(email)

    def find_last(self):
        stmt = db.session.query(Lift) \
            .filter(Set.lift_id == Lift.id) \
            .filter(Lift.workout_id == Workout.id) \
            .filter(Workout.user_id == self.id) \
            .order_by(asc(Workout.date)).subquery()

        lift = db.aliased(Lift, stmt)

        return db.session.query(lift).distinct(lift.name)


@app.before_request
def add_request_identity():
    flask.g.identity = User.current_identity()


@app.context_processor
def inject_identity():
    return {
        "identity": flask.g.identity,
        "identity_email": flask.g.identity.email if flask.g.identity is not None \
                                                 else None
    }


class Workout(db.Model, IdMixin):
    __tablename__ = "workouts"

    date = db.Column(db.Date, nullable=False)
    comment = db.Column(db.Text, nullable=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)

    user = db.relationship("User", backref=db.backref("workouts",
                                                      cascade="all, delete, delete-orphan",
                                                      lazy="dynamic",
                                                      order_by="desc(Workout.date)"))

    def to_api(self):
        return {
            "id": self.id,
            "date": self.date.strftime("%Y-%m-%d"),
            "comment": self.comment,
            "lifts": [l.to_api() for l in self.lifts]
        }

    @classmethod
    def from_api(cls, payload):
        w = cls(date=datetime.datetime.strptime(payload["date"], "%Y-%m-%d").date(),
                comment=payload.get("comment", None))

        for i, lift in enumerate(payload["lifts"]):
            l = Lift.from_api(lift)
            l.order = i
            l.workout = w

        return w


class Lift(db.Model, IdMixin):
    __tablename__ = "lifts"

    SYNONYMS = {
        "squats": "squat",
        "deadlifts": "deadlift",
        "bench": "bench_press",
        "overhead": "overhead_press"
    }

    ACCEPTABLE_NAMES = {"squat", "deadlift", "bench_press", "overhead_press", "power_clean",
                        "front_squat"}

    name = db.Column(db.String, nullable=False, index=True)
    order = db.Column(db.Integer, nullable=False)

    workout_id = db.Column(db.Integer, db.ForeignKey("workouts.id"), nullable=False)

    workout = db.relationship("Workout", backref=db.backref("lifts",
                                                            cascade="all, delete, delete-orphan",
                                                            lazy="joined",
                                                            order_by="Lift.order"))

    def to_api(self):
        return {
            "name": self.name,
            "sets": [s.to_api() for s in self.sets]
        }

    @classmethod
    def from_api(cls, payload):
        name = payload["name"].replace(" ", "_").lower()
        name = cls.SYNONYMS.get(name, name)

        if name not in cls.ACCEPTABLE_NAMES:
            raise ValueError("{} not an acceptable lift".format(name))

        l = cls(name=name)

        for i, set in enumerate(payload["sets"]):
            s = Set.from_api(set)
            s.order = i
            s.lift = l

        return l


class Set(db.Model, IdMixin):
    __tablename__ = "sets"

    weight = db.Column(db.Float, nullable=False)
    reps = db.Column(db.Integer, nullable=False)
    order = db.Column(db.Integer, nullable=False)

    lift_id = db.Column(db.Integer, db.ForeignKey("lifts.id"), nullable=False)

    lift = db.relationship("Lift", backref=db.backref("sets",
                                                      cascade="all, delete, delete-orphan",
                                                      lazy="joined",
                                                      order_by="Set.order"))

    def to_api(self):
        return {
            "weight": self.weight,
            "reps": self.reps
        }

    @classmethod
    def from_api(cls, payload):
        return cls(weight=payload["weight"], reps=payload["reps"])

