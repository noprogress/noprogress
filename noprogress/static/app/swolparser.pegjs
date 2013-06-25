swol
    = workouts:(workouts)? {
        return workouts.length == 0 ? [] : workouts;
    }

workouts
    = head:workout tail:("\n" workout)* {
        return [head].concat(tail.map(function (x) { return x[1]; }));
    }

workout
    = date:date "|" lifts:lifts comment:("#" comment)? {
        return { date: date, lifts: lifts, comment: comment[0] == "#" ? comment[1] : null };
    }

comment
    = comment:[^\n]* {
        return comment.join("");
    }

date
    = date:([0-9][0-9][0-9][0-9] "-" [0-9][0-9] "-" [0-9][0-9]) {
        return (new Date(date.join(""))).valueOf() / 1000;
    }


lifts
    = head:lift tail:("," lift)* {
        return [head].concat(tail.map(function (x) { return x[1]; }));
    }

lift
    = type:[^@]* "@" sets:sets {
        return { type: type.join(""), sets: sets };
    }

sets
    = head:set tail:("+" set)* {
        return [head].concat(tail.map(function (x) { return x[1]; }));
    }

set
    = weight:weight "x" reps:reps {
        return { weight: weight, reps: reps };
    }

weight
    = whole:[0-9]+ decimal:("." [0-9]*)? {
        return parseFloat(whole.join("") + (decimal || []).join(""));
    }

reps
    = number:[0-9]+ {
        return parseInt(number);
    }
