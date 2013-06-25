import flask
import requests
import json
import functools
import datetime

from flask import g

from . import app, db
from models import User, Workout, LiftType
from . import swol


def require_auth(f):
    @functools.wraps(f)
    def _wrapper(*args, **kwargs):
        if not g.identity:
            flask.abort(401)
        return f(*args, **kwargs)
    return _wrapper


@app.route("/")
def home():
    return flask.render_template("app.html")


@app.route("/api/workout")
@require_auth
def list_workouts():
    user = g.identity

    offset = int(flask.request.args.get("offset", 0))
    limit = int(flask.request.args.get("limit", -1))

    q = user.workouts.offset(offset)
    if limit > -1:
        q = q.limit(limit)

    format = flask.request.args.get("format", None)

    workouts = [x.to_api() for x in q]

    if format == "swol":
        return flask.Response("\n".join(swol.dump_workout(l) for l in workouts),
                              mimetype="text/plain",
                              headers={
            "Content-Disposition": "attachment;filename=\"workouts-{}.swol\"".format(datetime.date.today().strftime("%Y-%m-%d"))
        })

    return flask.jsonify({
        "total": user.workouts.count(),
        "workouts": workouts
    })


@app.route("/api/lift_type")
@require_auth
def list_lift_types():
    return flask.jsonify({
        "lift_types": [t.to_api() for t in db.session.query(LiftType).order_by(LiftType.name).all()]
    })


@app.route("/api/last")
@require_auth
def list_last():
    user = g.identity

    return flask.jsonify({l.lift_type.name: l.to_api()["sets"] for l in user.find_last()})


@app.route("/api/multi", methods=["POST"])
@require_auth
def multi():
    session = db.session()

    for payload in flask.request.json["workouts"]:
        w = Workout.from_api(payload)
        w.user = g.identity
        session.add(w)

    session.commit()

    return flask.jsonify({
        "status": "ok"
    })


@app.route("/api/workout", methods=["POST"])
@require_auth
def new_workout():
    session = db.session()

    w = Workout.from_api(flask.request.json)
    w.user = g.identity

    session.add(w)
    session.commit()

    return flask.jsonify({
        "status": "ok"
    })


@app.route("/api/workout", methods=["DELETE"])
@require_auth
def delete_workouts():
    session = db.session()
    session.query(Workout) \
        .filter(Workout.user == g.identity) \
        .delete()
    session.commit()

    return flask.jsonify({
        "status": "ok"
    })


@app.route("/api/workout/<int:id>", methods=["DELETE"])
@require_auth
def delete_workout(id):
    session = db.session()
    session.query(Workout) \
        .filter(Workout.user == g.identity) \
        .filter(Workout.id == id) \
        .delete()
    session.commit()

    return flask.jsonify({
        "status": "ok"
    })


@app.route("/api/auth/login", methods=["POST"])
def login():
    if "assertion" not in flask.request.form:
        flask.abort(400)

    data = {
        "assertion": flask.request.form["assertion"],
        "audience": app.config["PERSONA_AUDIENCE"]
    }
    resp = requests.post("https://verifier.login.persona.org/verify",
                         data=data,
                         verify=True)

    if resp.ok:
        verification_data = json.loads(resp.content)

        if verification_data["status"] == "okay":
            email = flask.session["identity_email"] = verification_data["email"]

            # Check if the user exists -- if not, create him.
            u = User.by_email(email)
            if u is None:
                u = User(email=email)
                s = db.session()
                s.add(u)
                s.commit()

            return flask.jsonify({
                "status": "ok",
                "identity_email": email
            })

    flask.abort(500)


@app.route("/api/auth/logout", methods=["POST"])
def logout():
    try:
        del flask.session["identity_email"]
    except KeyError:
        pass

    return flask.jsonify({
        "status": "ok"
    })
