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

    directive("fdatepicker", function () {
        return {
            scope: true,
            require: "ngModel",

            link: function(scope, element, attrs, ctrl) {
                $(element).fdatepicker().on("changeDate", function (e) {
                    scope.$apply(function() {
                        ctrl.$setViewValue($(element).val());
                    });
                });
            }
        };
    }).

    directive("swol", function () {
        return {
            scope: true,
            require: "ngModel",

            link: function(scope, element, attrs, ctrl) {
                ctrl.$parsers.unshift(function (value) {
                    var valid = true;
                    var out;
                    try {
                        out = swolparser.parse(value);
                    } catch (e) {
                        valid = false;
                    }
                    ctrl.$setValidity("syntax", valid);
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

    factory("api", function ($http, $rootScope) {
        var api = {
            lifts: ["squat", "overhead_press", "bench_press", "deadlift", "power_clean"],
            liftNames: {
                squat: "Squat",
                overhead_press: "Overhead Press",
                bench_press: "Bench Press",
                deadlift: "Deadlift",
                power_clean: "Power Clean"
            },

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
                            workout.liftSetsMap = {};
                            workout.lifts.forEach(function (lift) {
                                workout.liftSetsMap[lift.name] = lift.sets;
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
                 [Infinity, 106, 196, 239, 327, 384]]
            }
         };

        return {
            wathan: wathan,
            tables: tables,
            calculateGrades: calculateGrades,
            kgToLb: kgToLb,
            lbToKg: lbToKg
        };
    }).

    directive("workoutchart", function (api, strStd, $rootScope) {
        var margin = {top: 20, right: 100, bottom: 30, left: 60},
            width = 960 - margin.left - margin.right,
            height = 250 - margin.top - margin.bottom;

        function onermCalc(sets) {
            return strStd.wathan(sets[0].weight, sets[0].reps);
        }

        return {
            restrict: "E",
            link: function (scope, element, attrs) {
                var parseDate = d3.time.format("%Y-%m-%d").parse;

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

                    api.listWorkouts(0, -1, function(err, data) {
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
                        workouts.forEach(function (d) {
                            d.date = parseDate(d.date);
                        });

                        color.domain(api.lifts);

                        var onerms = color.domain().map(function (name) {
                            return {
                                name: name,
                                values: workouts.reduce(function (acc, d) {
                                    if (Object.prototype.hasOwnProperty.call(d.liftSetsMap, name)) {
                                        acc.push({
                                            date: d.date,
                                            onerm: onermCalc(d.liftSetsMap[name])
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
                            .text(function (d) { return api.liftNames[d.name]; });
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
        $scope.gender = "male";

        $scope.grades = {};
        $scope.onerms = {};
        $scope.roundedOnerms = {};
        $scope.percents = {};

        $scope.refresh = function () {
            api.last(function (err, data) {
                if (err !== null) return;

                $scope.last = data;

                $scope.hasLifts = false;
                Object.keys(data).forEach(function (k) {
                    if (!~api.lifts.indexOf(k)) {
                        return;
                    }

                    $scope.hasLifts = true;

                    var v = data[k][0];
                    $scope.onerms[k] = strStd.wathan(v.weight, v.reps);
                    $scope.roundedOnerms[k] = Math.round($scope.onerms[k]);
                    $scope.grades[k] = strStd.calculateGrades($scope.gender, k, $scope.bodyweight);
                    $scope.percents[k] = {};

                    var onerm = $scope.onerms[k];
                    var grades = $scope.grades[k];
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
            });
        };
        $scope.refresh();
        $scope.$on("workouts.updated", $scope.refresh);
    }).

    controller("MultiLogCtrl", function ($rootScope, $scope, api) {
        $scope.doMultiLog = function () {
            var workouts = swolparser.parse($scope.logs);

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

    controller("LogWorkoutCtrl", function ($rootScope, $scope, api) {
        $scope.reset = function () {
            $scope.workout = {
                lifts: []
            };

            $scope.maxSets = 0;
            $scope.maxSetsRange = [];
            $scope.addLift();
        };

        $scope.recalculateMaxSets = function () {
            $scope.maxSets = Math.max.apply(Math, $scope.workout.lifts.map(function (l) {
                return l.sets.length;
            }));

            $scope.maxSetsRange = [];
            for (var i = 1; i <= $scope.maxSets; ++i) {
                $scope.maxSetsRange.push(i);
            }
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
            $scope.recalculateMaxSets();
        };

        $scope.addSet = function (lift) {
            lift.sets.push({
                weight: null,
                reps: null
            });

            $scope.recalculateMaxSets();
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
