def dump_lift(lift):
    return "{}@{}".format(lift["type"],
                          "+".join("{}x{}".format(set["weight"], set["reps"]) for set in lift["sets"]))


def dump_workout(workout):
    comment = workout["comment"]
    workout = "{}{}|{}".format(workout["date"], workout["bodyweight"] and "@" + str(workout["bodyweight"]) or "",
                               ",".join(dump_lift(lift) for lift in workout["lifts"]))
    if comment is not None:
        workout += "#" + comment

    return workout
