swol
    = date:date "|" lifts:lifts {
        return { date: date, lifts: lifts };
    }

date
    = date:([0-9][0-9][0-9][0-9] "-" [0-9][0-9] "-" [0-9][0-9]) {
        return date.join("");
    }


lifts
    = head:lift tail:("," lift)* {
        return [head].concat(tail.map(function (x) { return x[1]; }));
    }

lift
    = name:[^@]* "@" sets:sets {
        return { name: name.join(""), sets: sets };
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
        return parseFloat(whole.join("") + decimal.join(""));
    }

reps
    = number:[0-9]+ {
        return parseInt(number);
    }
