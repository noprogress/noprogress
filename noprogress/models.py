import datetime
import flask
from sqlalchemy.orm import validates
from sqlalchemy.orm.exc import NoResultFound, MultipleResultsFound
from sqlalchemy.sql.expression import desc
import pytz

from . import app, db


class IdMixin(object):
    """
    A mixin for entities that want a primary key.
    """
    id = db.Column(db.Integer, primary_key=True, nullable=False)

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
        return db.session.query(Lift) \
            .filter(Set.lift_id == Lift.id) \
            .filter(Lift.workout_id == Workout.id) \
            .filter(Lift.lift_type_id == LiftType.id) \
            .filter(Workout.user_id == self.id) \
            .order_by(LiftType.name) \
            .order_by(desc(Workout.date)) \
            .distinct(LiftType.name)

    def find_last_bodyweight(self):
        w = db.session.query(Workout) \
            .filter(Workout.user_id == self.id) \
            .filter(Workout.bodyweight != None) \
            .order_by(desc(Workout.date)) \
            .first()
        if w is None:
            return None
        return w.bodyweight

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
    bodyweight = db.Column(db.Float, nullable=True)
    comment = db.Column(db.Text, nullable=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"),
                        nullable=False)

    user = db.relationship("User", backref=db.backref("workouts",
                                                      cascade="all, delete, delete-orphan",
                                                      lazy="dynamic",
                                                      order_by="desc(Workout.date)"))

    def to_api(self):
        return {
            "id": self.id,
            "date": self.date.strftime("%Y-%m-%d"),
            "bodyweight": self.bodyweight,
            "comment": self.comment,
            "lifts": [l.to_api() for l in self.lifts]
        }

    @classmethod
    def from_api(cls, payload):
        w = cls(date=datetime.datetime.strptime(payload["date"], "%Y-%m-%d").date(),
                bodyweight=payload.get("bodyweight", None),
                comment=payload.get("comment", None))

        for i, lift in enumerate(payload["lifts"]):
            l = Lift.from_api(lift)
            l.order = i
            l.workout = w

        return w


class LiftType(db.Model, IdMixin):
    __tablename__ = "lift_types"

    name = db.Column(db.String, nullable=False, unique=True)

    @classmethod
    def by_name(cls, name):
        try:
            return db.session.query(cls).filter(cls.name == name).one()
        except (NoResultFound, MultipleResultsFound):
            return None

    def to_api(self):
        return self.name

    @classmethod
    def from_api(cls, payload):
        lift_type = cls.by_name(payload.replace(" ", "_").lower())
        if lift_type is None:
            raise ValueError("unacceptable lift: " + lift_type)
        return lift_type


class Lift(db.Model, IdMixin):
    __tablename__ = "lifts"

    lift_type_id = db.Column(db.Integer, db.ForeignKey("lift_types.id", ondelete="CASCADE"),
                             nullable=False)

    lift_type = db.relationship("LiftType", lazy="joined")

    order = db.Column(db.Integer, nullable=False)

    workout_id = db.Column(db.Integer, db.ForeignKey("workouts.id", ondelete="CASCADE"),
                           nullable=False)

    workout = db.relationship("Workout", backref=db.backref("lifts",
                                                            cascade="all, delete, delete-orphan",
                                                            lazy="joined",
                                                            order_by="Lift.order"))

    def to_api(self):
        return {
            "type": self.lift_type.to_api(),
            "sets": [s.to_api() for s in self.sets]
        }

    @classmethod
    def from_api(cls, payload):
        lift_type = LiftType.from_api(payload["type"])

        l = cls(lift_type=lift_type)

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

    @validates("weight")
    def validate_weight(self, key, weight):
        if weight < 0:
            raise ValueError("weight must be >= 0")
        return weight

    @validates("reps")
    def validate_reps(self, key, reps):
        if reps < 0:
            raise ValueError("reps must be >= 0")
        return reps

    lift_id = db.Column(db.Integer, db.ForeignKey("lifts.id", ondelete="CASCADE"),
                        nullable=False)

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
