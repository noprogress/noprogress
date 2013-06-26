/*jshint loopfunc: true */
(function () {
    "use strict";
    $(document).foundation();

    var noprogress = angular.module("noprogress", []);

    noprogress.

    config(function ($interpolateProvider) {
        $interpolateProvider.startSymbol("<%=");
        $interpolateProvider.endSymbol("%>");
    }).

    directive("eatClick", function () {
        return function(scope, element, attrs) {
            $(element).click(function(event) {
                event.preventDefault();
            });
        };
    }).

    directive("fdatepicker", function ($filter) {
        return {
            scope: true,
            require: "ngModel",

            link: function(scope, element, attrs, ctrl) {
                $(element).fdatepicker().on("changeDate", function (e) {
                    scope.$apply(function() {
                        ctrl.$setViewValue($(element).val());
                    });
                });

                ctrl.$parsers.push(function (value) {
                    return new Date(value) / 1000;
                });

                ctrl.$formatters.push(function (value) {
                    return $filter("date")(new Date(value * 1000), "yyyy-MM-dd");
                });
            }
        };
    }).

    directive("swol", function (swol) {
        return {
            require: "ngModel",

            link: function(scope, element, attrs, ctrl) {
                ctrl.$parsers.unshift(function (value) {
                    var out;
                    try {
                        out = swol.parse(value || "");
                    } catch (e) {
                        if (e.name !== "SyntaxError") throw e;
                    }
                    ctrl.$setValidity("syntax", out !== void 0);
                    return out;
                });

                ctrl.$formatters.unshift(function (value) {
                    return value;
                });
            }
        };
    }).

    factory("persona", function ($rootScope, $http) {
        $rootScope.identity = window.identity || null;

        navigator.id.watch({
            loggedInUser: $rootScope.identity,

            onlogin: function (assertion) {
                $http({
                    method: "POST",
                    headers: {"Content-Type": "application/x-www-form-urlencoded"},
                    url: "/api/auth/login",
                    data: "assertion=" + encodeURIComponent(assertion)
                }).
                    success(function (data, status, headers, config) {
                        $rootScope.identity = data.identity_email;
                        $rootScope.$broadcast("auth.login");
                        $rootScope.$broadcast("workouts.updated");
                    }).
                    error(function (err, status, headers, config) {
                        alert("Login failure: " + err);
                        navigator.id.logout();
                    });
            },

            onlogout: function () {
                $http({
                    method: "POST",
                    url: "/api/auth/logout"
                }).
                    success(function (data, status, headers, config) {
                        $rootScope.identity = null;
                        $rootScope.$broadcast("auth.logout");
                    }).
                    error(function (err, status, headers, config) {
                        alert("Logout failure: " + err);
                    });
            }
        });

        return {
            signin: function () {
                navigator.id.request({
                    siteName: "noprogress"
                });
            },

            signout: function () {
                navigator.id.logout();
            }
        };
    }).

    factory("swol", function () {
        return {
            parse: function (value) {
                return window.swolparser.parse(value);
            }
        };
    }).

    factory("api", function ($http, $rootScope) {
        var api = {
            lifts: [],

            last: function last(cont) {
                $http({
                    method: "GET",
                    url: "/api/last"
                }).
                    success(function (data, status, headers, config) {
                        cont(null, data);
                    }).
                    error(function (err, status, headers, config) {
                        cont(err, null);
                    });
            },

            multi: function multi(payload, cont) {
                $http({
                    method: "POST",
                    url: "/api/multi",
                    data: payload
                }).
                    success(function (data, status, headers, config) {
                        cont(null, data);
                    }).
                    error(function (err, status, headers, config) {
                        cont(err, null);
                    });
            },

            newWorkout: function newWorkout(workout, cont) {
                $http({
                    method: "POST",
                    url: "/api/workout",
                    data: workout
                }).
                    success(function (data, status, headers, config) {
                        cont(null, data);
                    }).
                    error(function (err, status, headers, config) {
                        cont(err, null);
                    });
            },

            deleteWorkout: function deleteWorkout(id, cont) {
                $http({
                    method: "DELETE",
                    url: "/api/workout/" + encodeURIComponent(id)
                }).
                    success(function (data, status, headers, config) {
                        cont(null, data);
                    }).
                    error(function (err, status, headers, config) {
                        cont(err, null);
                    });
            },

            deleteWorkouts: function deleteWorkouts(cont) {
                $http({
                    method: "DELETE",
                    url: "/api/workout"
                }).
                    success(function (data, status, headers, config) {
                        cont(null, data);
                    }).
                    error(function (err, status, headers, config) {
                        cont(err, null);
                    });
            },

            listLiftTypes: function last(cont) {
                $http({
                    method: "GET",
                    url: "/api/lift_type"
                }).
                    success(function (data, status, headers, config) {
                        cont(null, data);
                    }).
                    error(function (err, status, headers, config) {
                        cont(err, null);
                    });
            },

            listWorkouts: function listWorkouts(offset, limit, cont) {
                $http({
                    method: "GET",
                    url: "/api/workout",
                    params: {
                        offset: offset,
                        limit: limit
                    }
                }).
                    success(function (data, status, headers, config) {
                        var workouts = data.workouts;

                        workouts.forEach(function (workout) {
                            workout.date = new Date(workout.date * 1000);
                            workout.liftSetsMap = {};
                            workout.lifts.forEach(function (lift) {
                                workout.liftSetsMap[lift.type] = lift.sets;
                            });
                        });

                        cont(null, data);
                    }).
                    error(function (err, status, headers, config) {
                        cont(err, null);
                    });
            }
        };

        $rootScope.api = api;
        return api;
    }).

    factory("strStd", function () {
        function wathan(w, r) {
            return 100 * w / (48.8 + 53.8 * Math.pow(Math.E, -0.075 * r));
        }

        function lbToKg(lb) {
            return lb / 2.20462;
        }

        function kgToLb(kg) {
            return kg * 2.20462;
        }

        function calculateGrades(sex, lift, bw) {
            var table = tables[sex][lift];
            if (!table) return null;

            for (var i = 0; i < table.length; ++i) {
                var bwLimit = lbToKg(table[i][0]);
                if (bw < bwLimit) {
                    var bits = table[i].slice(1).map(function (v) {
                        return Math.round(lbToKg(v));
                    });

                    return {
                        untrained: bits[0],
                        novice: bits[1],
                        intermediate: bits[2],
                        advanced: bits[3],
                        elite: bits[4]
                    };
                }
            }
        }

        // These tables are taken from:
        // http://push-hard.blogspot.com/2009/10/basic-strength-standards-for-adult-men.html
        // http://push-hard.blogspot.com/2009/10/basic-strength-standards-for-adult.html
        var tables = {
            female: {
                overhead_press:
                [[97, 31, 42, 50, 66, 85],
                 [105, 33, 46, 53, 71, 91],
                 [114, 36, 49, 58, 76, 97],
                 [123, 38, 52, 61, 81, 104],
                 [132, 40, 55, 65, 85, 110],
                 [148, 44, 60, 72, 94, 121],
                 [165, 48, 65, 77, 102, 134],
                 [181, 51, 70, 83, 110, 140],
                 [198, 55, 75, 89, 117, 151],
                 [Infinity, 58, 79, 93, 123, 159]],

                bench_press:
                [[97, 49, 63, 73, 94, 116],
                 [105, 53, 68, 79, 102, 124],
                 [114, 57, 73, 85, 109, 133],
                 [123, 60, 77, 90, 116, 142],
                 [132, 64, 82, 95, 122, 150],
                 [148, 70, 90, 105, 135, 165],
                 [165, 76, 97, 113, 146, 183],
                 [181, 81, 104, 122, 158, 192],
                 [198, 88, 112, 130, 167, 205],
                 [Infinity, 92, 118, 137, 177, 217]],

                squat:
                [[97, 46, 84, 98, 129, 163],
                 [105, 49, 91, 106, 140, 174],
                 [114, 53, 98, 114, 150, 187],
                 [123, 56, 103, 121, 160, 199],
                 [132, 59, 110, 127, 168, 211],
                 [148, 65, 121, 141, 185, 232],
                 [165, 70, 130, 151, 200, 256],
                 [181, 75, 139, 164, 215, 268],
                 [198, 81, 150, 174, 229, 288],
                 [Infinity, 85, 158, 184, 242, 303]],

                deadlift:
                [[97, 57, 105, 122, 175, 232],
                 [105, 61, 114, 132, 189, 242],
                 [114, 66, 122, 142, 200, 253],
                 [123, 70, 129, 151, 211, 263],
                 [132, 74, 137, 159, 220, 273],
                 [148, 81, 151, 176, 241, 295],
                 [165, 88, 162, 189, 258, 319],
                 [181, 94, 174, 204, 273, 329],
                 [198, 101, 187, 217, 284, 349],
                 [Infinity, 107, 197, 229, 297, 364]],

                power_clean:
                [[97, 33, 61, 70, 93, 117],
                 [105, 35, 66, 76, 101, 125],
                 [114, 38, 70, 82, 108, 135],
                 [123, 40, 74, 87, 115, 143],
                 [132, 43, 79, 92, 121, 152],
                 [148, 47, 87, 101, 133, 167],
                 [165, 50, 93, 109, 144, 184],
                 [181, 54, 100, 118, 155, 193],
                 [198, 58, 108, 125, 165, 207],
                 [Infinity, 61, 114, 132, 174, 218]],

                power_snatch:
                [[97, 26, 48, 55, 73, 91],
                 [105, 27, 51, 59, 79, 98],
                 [114, 30, 55, 64, 84, 105],
                 [123, 31, 58, 68, 90, 112],
                 [132, 34, 62, 72, 94, 119],
                 [148, 37, 68, 79, 104, 130],
                 [165, 39, 73, 85, 112, 144],
                 [181, 42, 78, 92, 121, 151],
                 [198, 45, 84, 98, 129, 161],
                 [Infinity, 48, 89, 103, 136, 170]]
            },

            male: {
                overhead_press:
                [[114, 53, 72, 90, 107, 129],
                 [123, 57, 78, 98, 116, 141],
                 [132, 61, 84, 105, 125, 151],
                 [148, 69, 94, 119, 140, 169],
                 [165, 75, 102, 129, 153, 186],
                 [181, 81, 110, 138, 164, 218],
                 [198, 85, 116, 146, 173, 234],
                 [220, 89, 122, 155, 183, 255],
                 [242, 93, 127, 159, 189, 264],
                 [275, 96, 131, 164, 194, 272],
                 [319, 98, 133, 167, 199, 278],
                 [Infinity, 100, 136, 171, 203, 284]],

                bench_press:
                [[114, 84, 107, 130, 179, 222],
                 [123, 91, 116, 142, 194, 242],
                 [132, 98, 125, 153, 208, 260],
                 [148, 109, 140, 172, 234, 291],
                 [165, 119, 152, 187, 255, 319],
                 [181, 128, 164, 201, 275, 343],
                 [198, 135, 173, 213, 289, 362],
                 [220, 142, 183, 225, 306, 381],
                 [242, 149, 190, 232, 316, 395],
                 [275, 153, 196, 239, 325, 407],
                 [319, 156, 199, 244, 333, 416],
                 [Infinity, 159, 204, 248, 340, 425]],

                squat:
                [[114, 78, 144, 174, 240, 320],
                 [123, 84, 155, 190, 259, 346],
                 [132, 91, 168, 205, 278, 369],
                 [148, 101, 188, 230, 313, 410],
                 [165, 110, 204, 250, 342, 445],
                 [181, 119, 220, 269, 367, 479],
                 [198, 125, 232, 285, 387, 504],
                 [220, 132, 244, 301, 409, 532],
                 [242, 137, 255, 311, 423, 551],
                 [275, 141, 261, 319, 435, 567],
                 [319, 144, 267, 326, 445, 580],
                 [Infinity, 147, 272, 332, 454, 593]],

                deadlift:
                [[114, 97, 179, 204, 299, 387],
                 [123, 105, 194, 222, 320, 414],
                 [132, 113, 209, 239, 342, 438],
                 [148, 126, 234, 269, 380, 482],
                 [165, 137, 254, 293, 411, 518],
                 [181, 148, 274, 315, 438, 548],
                 [198, 156, 289, 333, 457, 567],
                 [220, 164, 305, 351, 479, 586],
                 [242, 172, 318, 363, 490, 596],
                 [275, 176, 326, 373, 499, 602],
                 [319, 180, 333, 381, 506, 608],
                 [Infinity, 183, 340, 388, 512, 617]],

                power_clean:
                [[114, 56, 103, 125, 173, 207],
                 [123, 60, 112, 137, 186, 224],
                 [132, 65, 121, 148, 200, 239],
                 [148, 73, 135, 166, 225, 266],
                 [165, 79, 147, 180, 246, 288],
                 [181, 85, 158, 194, 264, 310],
                 [198, 90, 167, 205, 279, 327],
                 [220, 95, 176, 217, 294, 345],
                 [242, 99, 183, 224, 305, 357],
                 [275, 102, 188, 230, 313, 367],
                 [319, 104, 192, 235, 320, 376],
                 [Infinity, 106, 196, 239, 327, 384]],

                power_snatch:
                [[114, 44, 80, 98, 135, 161],
                 [123, 47, 87, 107, 145, 175],
                 [132, 51, 94, 115, 156, 186],
                 [148, 57, 105, 129, 176, 207],
                 [165, 62, 115, 140, 192, 225],
                 [181, 66, 123, 151, 206, 242],
                 [198, 70, 130, 160, 218, 255],
                 [220, 74, 137, 169, 229, 269],
                 [242, 77, 143, 175, 238, 278],
                 [275, 80, 147, 179, 244, 286],
                 [319, 81, 150, 183, 250, 293],
                 [Infinity, 83, 153, 186, 255, 300]]
            }
         };

        function onerm(sets) {
            return Math.max.apply(Math, sets.map(function (set) {
                return wathan(set.weight, set.reps);
            }));
        }

        return {
            wathan: wathan,
            tables: tables,
            calculateGrades: calculateGrades,
            kgToLb: kgToLb,
            lbToKg: lbToKg,
            onerm: onerm
        };
    }).

    directive("workoutchart", function (api, strStd, $rootScope, $filter) {
        var margin = {top: 20, right: 100, bottom: 30, left: 60},
            width = 960 - margin.left - margin.right,
            height = 250 - margin.top - margin.bottom;

        return {
            restrict: "E",
            link: function (scope, element, attrs) {
                function refresh() {
                    var color = d3.scale.category10();

                    var x = d3.time.scale()
                        .range([0, width]);

                    var y = d3.scale.linear()
                        .range([height, 0]);

                    var xAxis = d3.svg.axis()
                        .scale(x)
                        .orient("bottom");

                    var yAxis = d3.svg.axis()
                        .scale(y)
                        .orient("left");

                    var line = d3.svg.line()
                        .interpolate("basis")
                        .x(function(d) { return x(d.date); })
                        .y(function(d) { return y(d.onerm); });

                    api.listWorkouts(0, 50, function(err, data) {
                        if (err !== null) return;

                        d3.select(element[0]).selectAll("svg").remove();

                        if (data.total === 0) {
                            return;
                        }

                        var svg = d3.select(element[0])
                            .append("svg")
                            .attr("width", width + margin.left + margin.right)
                            .attr("height", height + margin.top + margin.bottom)
                            .append("g")
                                .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

                        var workouts = data.workouts;

                        var lifts = data.workouts.reduce(function (acc, x) {
                            return _.union(acc, Object.keys(x.liftSetsMap));
                        }, []).sort();

                        color.domain(lifts);

                        var onerms = color.domain().map(function (name) {
                            return {
                                name: name,
                                values: workouts.reduce(function (acc, d) {
                                    if (Object.prototype.hasOwnProperty.call(d.liftSetsMap, name)) {
                                        acc.push({
                                            date: d.date,
                                            onerm: strStd.onerm(d.liftSetsMap[name])
                                        });
                                    }
                                    return acc;
                                }, [])
                            };
                        });

                        x.domain(d3.extent(workouts, function(d) { return d.date; }));
                        y.domain([
                            0,
                            d3.max(onerms, function(c) { return d3.max(c.values, function(v) { return v.onerm; }); })
                        ]);

                        svg.append("g")
                            .attr("class", "x grid")
                            .attr("transform", "translate(0," + height + ")")
                            .call(d3.svg.axis().scale(x).tickSubdivide(1).tickSize(-height));

                        svg.append("g")
                            .attr("class", "y grid")
                            .attr("transform", "rotate(90)")
                            .call(d3.svg.axis().scale(y).tickSubdivide(1).tickSize(-width));

                        svg.append("g")
                            .attr("class", "x axis")
                            .attr("transform", "translate(0," + height + ")")
                            .call(xAxis);

                        svg.append("g")
                            .attr("class", "y axis")
                            .call(yAxis)
                            .append("text")
                                .attr("transform", "rotate(-90)")
                                .attr("y", 6)
                                .attr("dy", ".71em")
                                .style("text-anchor", "end")
                                .text("1RM (kg)");

                        var onerm = svg.selectAll(".onerm")
                            .data(onerms)
                            .enter().append("g")
                                .attr("class", "onerm");

                        onerm.append("path")
                            .attr("class", "line")
                            .attr("d", function(d) { return line(d.values); })
                            .style("stroke", function(d) { return color(d.name); });

                        var points = svg.selectAll(".series")
                            .data(onerms)
                            .enter().append("g")
                                .style("fill", function (d, i) { return color(d.name); })
                                .selectAll(".point")
                                .data(function (d) { return d.values; })
                                .enter().append("svg:circle")
                                    .attr("cx", function (d, i) { return x(d.date); })
                                    .attr("cy", function (d, i) { return y(d.onerm); })
                                    .attr("r", function (d, i) { return 2; });

                        var legend = svg.append("g")
                            .attr("class", "legend")
                            .selectAll(".series")
                            .data(onerms)
                            .enter()
                            .append("g")
                                .attr("transform", "translate(" + (width + 5) + ",0)")
                                .attr("class", "series");

                        legend.append("rect")
                            .attr("x", 0)
                            .attr("y", function(d, i){ return i * 20; })
                            .attr("width", 10)
                            .attr("height", 10)
                            .style("fill", function(d) {
                                return color(d.name);
                            });

                        legend.append("text")
                            .attr("x", 20)
                            .attr("y", function (d, i) { return (i *  20) + 9;})
                            .text(function (d) { return $filter("liftName")(d.name); });
                    });
                }

                $rootScope.$on("workouts.updated", refresh);
                refresh();
            }
        };
    }).

    filter("reprSets", function () {
        return function (sets) {
            if (!sets) return "";
            return sets.map(function (set) { return set.weight + "kgx" + set.reps; }).join("<br>");
        };
    }).

    filter("liftName", function () {
        return function (name) {
            var v = name.replace(/_./, function (x) {
                return " " + x[1].toUpperCase();
            });
            v = v[0].toUpperCase() + v.slice(1);
            return v;
        };
    }).

    controller("NavBarCtrl", function (persona, $scope) {
        $scope.signin = function () {
            persona.signin();
        };

        $scope.signout = function () {
            persona.signout();
        };

        $scope.clearLogs = function () {
            $("#clearLogsModal").foundation("reveal", "open");
        };
    }).

    controller("DialogCtrl", function ($scope, $rootScope, api) {
        $scope.dismissClearLogs = function () {
            $("#clearLogsModal").foundation("reveal", "close");
        };

        $scope.confirmClearLogs = function () {
            api.deleteWorkouts(function (err, data) {
                if (err) return;
                $scope.dismissClearLogs();
                $rootScope.$broadcast("workouts.clobbered");
            });
        };
    }).

    controller("StrStdCtrl", function ($rootScope, $scope, strStd, api) {
        $scope.bodyweight = 70;
        $scope.sex = "male";

        $scope.refresh = function () {
            api.last(function (err, data) {
                $scope.liftNames = [];
                $scope.grades = {};
                $scope.onerms = {};
                $scope.roundedOnerms = {};
                $scope.percents = {};

                if (err !== null) return;

                $scope.last = data;

                Object.keys(data).forEach(function (k) {
                    var grades = strStd.calculateGrades($scope.sex, k, $scope.bodyweight);
                    if (grades === null) return;

                    $scope.liftNames.push(k);
                    $scope.onerms[k] = strStd.onerm(data[k]);
                    $scope.roundedOnerms[k] = Math.round($scope.onerms[k]);
                    $scope.grades[k] = grades;
                    $scope.percents[k] = {};

                    var onerm = $scope.onerms[k];
                    var percent = 0;

                    if (onerm < grades.novice) {
                        percent = (onerm / grades.novice) * 0.25;
                    } else if (onerm < grades.intermediate) {
                        percent = (onerm / grades.intermediate) * 0.50;
                    } else if (onerm < grades.advanced) {
                        percent = (onerm / grades.advanced) * 0.75;
                    } else if (onerm < grades.elite) {
                        percent = onerm / grades.elite;
                    } else {
                        percent = 1;
                    }
                    $scope.percents[k] = Math.round(percent * 100);
                });

                $scope.liftNames.sort();
            });
        };
        $scope.refresh();
        $scope.$on("workouts.updated", $scope.refresh);
    }).

    controller("MultiLogCtrl", function ($rootScope, $scope, api) {
        $scope.doMultiLog = function () {
            var workouts = $scope.logs;
            api.multi({workouts: workouts}, function (err, data) {
                if (err !== null) return;

                $scope.logs = "";
                $rootScope.$broadcast("workouts.clobbered");
            });
        };

        $scope.disablePowerUser = function () {
            $rootScope.powerUser = false;
        };
    }).

    controller("LogWorkoutCtrl", function ($rootScope, $scope, $filter, api) {
        api.listLiftTypes(function (err, data) {
            $scope.liftTypes = data.lift_types.map(function (n) {
                return {
                    raw: n,
                    friendly: $filter("liftName")(n)
                };
            });
        });

        $scope.reset = function () {
            var today = new Date();
            var ts = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());

            $scope.workout = {
                date: ts / 1000,
                lifts: []
            };

            $scope.addLift();
        };

        $scope.addLift = function () {
            var lift = {
                name: null,
                sets: []
            };
            $scope.workout.lifts.push(lift);
            $scope.addSet(lift);
        };

        $scope.removeLift = function (lift) {
            var idx = $scope.workout.lifts.indexOf(lift);
            $scope.workout.lifts.splice(idx, 1);
        };

        $scope.removeSet = function (lift) {
            lift.sets.pop();
        };

        $scope.addSet = function (lift) {
            if (lift.sets.length >= 1) {
                lift.sets.push({
                    weight: lift.sets[lift.sets.length - 1].weight,
                    reps: lift.sets[lift.sets.length - 1].reps
                });
            } else {
                lift.sets.push({
                    weight: null,
                    reps: null
                });
            }
        };

        $scope.enablePowerUser = function () {
            $rootScope.powerUser = true;
        };

        $scope.reset();

        $scope.doLog = function (logForm) {
            if (!logForm.$valid) {
                return;
            }

            api.newWorkout($scope.workout, function (err, data) {
                if (err !== null) return;
                $rootScope.$broadcast("workouts.clobbered");
                $scope.reset();
            });
        };
    }).

    controller("WorkoutsCtrl", function ($rootScope, $scope, api) {
        $scope.limit = 5;
        $scope.currentPage = 1;

        $scope.goToPage = function (page) {
            $scope.currentPage = page;
            $scope.refresh();
        };

        $scope.nextPage = function () {
            var page = Math.min($scope.currentPage + 1, $scope.totalPages);
            $scope.goToPage(page);
        };

        $scope.previousPage = function () {
            var page = Math.max($scope.currentPage - 1, 1);
            $scope.goToPage(page);
        };

        $scope.removeWorkout = function (id) {
            api.deleteWorkout(id, function (err, data) {
                if (err !== null) return;
                $rootScope.$broadcast("workouts.updated");
            });
        };

        $scope.refresh = function (cont) {
            api.listWorkouts(($scope.currentPage - 1) * $scope.limit, $scope.limit, function (err, data) {
                if (err !== null) return;

                var workouts = data.workouts;

                $scope.workouts = workouts;
                $scope.totalPages = Math.max(Math.ceil(data.total / $scope.limit), 1);

                if ($scope.currentPage > $scope.totalPages) {
                    $scope.currentPage = $scope.totalPages;
                    $scope.refresh();
                }

                $scope.pages = [];

                for (var i = 1; i <= $scope.totalPages; ++i) {
                    $scope.pages.push(i);
                }
                if (cont) cont();
            });
        };
        $scope.refresh();

        $scope.$on("workouts.updated", function () {
            $scope.refresh();
        });

        $scope.$on("workouts.clobbered", function () {
            $scope.currentPage = 1;
            $rootScope.$broadcast("workouts.updated");
        });
    });
})();
