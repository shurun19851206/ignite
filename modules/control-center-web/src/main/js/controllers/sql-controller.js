/*
 * Licensed to the Apache Software Foundation (ASF) under one or more
 * contributor license agreements.  See the NOTICE file distributed with
 * this work for additional information regarding copyright ownership.
 * The ASF licenses this file to You under the Apache License, Version 2.0
 * (the "License"); you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// Controller for SQL notebook screen.
controlCenterModule.controller('sqlController', ['$scope', '$window','$controller', '$http', '$timeout', '$common', '$confirm',
    function ($scope, $window, $controller, $http, $timeout, $common, $confirm) {
    // Initialize the super class and extend it.
    angular.extend(this, $controller('agent-download', {$scope: $scope}));
    $scope.agentGoal = 'execute sql statements';
    $scope.agentTestDriveOption = '--test-sql';

    $scope.joinTip = $common.joinTip;

    $scope.pageSizes = [10, 25, 50];

    $scope.modes = [
        {value: 'PARTITIONED', label: 'PARTITIONED'},
        {value: 'REPLICATED', label: 'REPLICATED'},
        {value: 'LOCAL', label: 'LOCAL'}
    ];

    $scope.timeUnit = [
        {value: 's', label: 'seconds'},
        {value: 'm', label: 'minutes'},
        {value: 'h', label: 'hours'}
    ];

    $scope.exportDropdown = [{ 'text': 'Export all', 'click': 'exportAll(paragraph)'}];

    $scope.aceInit = function (editor) {
        editor.setAutoScrollEditorIntoView(true);
        editor.$blockScrolling = Infinity;

        var renderer = editor.renderer;

        renderer.setHighlightGutterLine(false);
        renderer.setShowPrintMargin(false);
        renderer.setOption('fontSize', '14px');
        renderer.setOption('minLines', '3');
        renderer.setOption('maxLines', '15');

        editor.setTheme('ace/theme/chrome');
    };

    var paragraphId = 0;

    var loadNotebook = function () {
        $http.post('/notebooks/get', {noteId: $scope.noteId})
            .success(function (notebook) {
                $scope.notebook = notebook;

                $scope.notebook_name = notebook.name;

                _.forEach(notebook.paragraphs, function (paragraph) {
                    paragraph.id = paragraphId++;
                });

                if (!notebook.paragraphs || notebook.paragraphs.length == 0)
                    $scope.addParagraph();
            })
            .error(function (errMsg) {
                $common.showError(errMsg);
            });
    };

    loadNotebook();

    var _saveNotebook = function (f) {
        $http.post('/notebooks/save', $scope.notebook)
            .success(f || function() {})
            .error(function (errMsg) {
                $common.showError(errMsg);
            });
    };

    $scope.renameNotebook = function (name) {
        if (!name)
            return;

        if ($scope.notebook.name != name) {
            $scope.notebook.name = name;

            _saveNotebook(function () {
                var idx = _.findIndex($scope.$root.notebooks, function (item) {
                    return item._id == $scope.notebook._id;
                });

                if (idx >= 0) {
                    $scope.$root.notebooks[idx].name = name;

                    $scope.$root.rebuildDropdown();
                }

                $scope.notebook.edit = false;
            });
        }
        else
            $scope.notebook.edit = false
    };

    $scope.removeNotebook = function () {
        $confirm.show('Are you sure you want to remove notebook: "' + $scope.notebook.name + '"?').then(
            function () {
                $http.post('/notebooks/remove', {_id: $scope.notebook._id})
                    .success(function () {
                        var idx = _.findIndex($scope.$root.notebooks, function (item) {
                            return item._id == $scope.notebook._id;
                        });

                        if (idx >= 0) {
                            $scope.$root.notebooks.splice(idx, 1);

                            if ($scope.$root.notebooks.length > 0)
                                $window.location = "/sql/" +
                                    $scope.$root.notebooks[Math.min(idx,  $scope.$root.notebooks.length - 1)]._id;
                            else
                                $scope.inputNotebookName();
                        }
                    })
                    .error(function (errMsg) {
                        $common.showError(errMsg);
                    });
            }
        );
    };

    $scope.renameParagraph = function (paragraph, newName) {
        if (!newName)
            return;

        if (paragraph.name != newName) {
            paragraph.name = newName;

            _saveNotebook(function () { paragraph.edit = false; });
        }
        else
            paragraph.edit = false
    };

    $scope.addParagraph = function () {
        if (!$scope.notebook.paragraphs)
            $scope.notebook.paragraphs = [];

        var sz = $scope.notebook.paragraphs.length;

        var paragraph = {id: paragraphId++, name: 'Query' + (sz ==0 ? '' : sz), editor: true, query: '', pageSize: $scope.pageSizes[0], result: 'none'};

        if ($scope.caches && $scope.caches.length > 0)
            paragraph.cache = $scope.caches[0];

        paragraph.rate = {ruined: false, value: 0, unit: $scope.timeUnit[0].value};

        $scope.notebook.expandedParagraphs.push($scope.notebook.paragraphs.length);

        $scope.notebook.paragraphs.push(paragraph);
    };

    $scope.setResult = function (paragraph, new_result) {
        paragraph.result = paragraph.result === new_result ? 'none' : new_result;

        if (paragraph.rows && paragraph.rows.length > 0) {
            switch (new_result) {
                case 'table':
                case 'none':
                    break;

                case 'bar':
                    _barChart(paragraph);
                    break;

                case 'pie':
                    _pieChart(paragraph);
                    break;

                case 'line':
                    _lineChart(paragraph);
                    break;

                case 'area':
                    _areaChart(paragraph);
                    break;

                default:
                    $common.showError('Unknown result: ' + new_result);
            }
        }
    };

    $scope.resultEq = function(paragraph, result) {
        return (paragraph.result === result);
    };

    $scope.removeParagraph = function(paragraph) {
        $confirm.show('Are you sure you want to remove paragraph: "' + paragraph.name + '"?').then(
            function () {
                var paragraph_idx = _.findIndex($scope.notebook.paragraphs, function (item) {
                    return paragraph == item;
                });

                var panel_idx = _.findIndex($scope.notebook.expandedParagraphs, function (item) {
                    return paragraph_idx == item;
                });

                if (panel_idx >= 0)
                    $scope.notebook.expandedParagraphs.splice(panel_idx, 1);

                $scope.notebook.paragraphs.splice(paragraph_idx, 1);
            }
        );
    };

    $http.get('/models/sql.json')
        .success(function (data) {
            $scope.screenTip = data.screenTip;
            $scope.missingClientTip = data.missingClientTip;
        })
        .error(function (errMsg) {
            $common.showError(errMsg);
        });

    $scope.caches = undefined;

    $http.post('/agent/topology')
        .success(function (clusters) {
            var node = clusters[0];

            $scope.caches = node.caches;
        })
        .error(function (err, status) {
            $scope.caches = undefined;

            if (status == 503)
                $scope.showDownloadAgent();
            else
                $common.showError('Receive agent error: ' + err);
        });

    var _appendOnLast = function (item) {
        var idx = _.findIndex($scope.notebook.paragraphs, function (paragraph) {
            return paragraph == item;
        });

        if ($scope.notebook.paragraphs.length == (idx + 1))
            $scope.addParagraph();
    };

    var _processQueryResult = function (item) {
        return function (res) {
            item.meta = [];

            if (res.meta)
                item.meta = res.meta;

            item.page = 1;

            item.total = 0;

            item.queryId = res.queryId;

            item.rows = res.rows;

            item.result = 'table';
        }
    };

    $scope.execute = function (item) {
        _saveNotebook();

        _appendOnLast(item);

        $http.post('/agent/query', {query: item.query, pageSize: item.pageSize, cacheName: item.cache.name})
            .success(_processQueryResult(item))
            .error(function (errMsg) {
                $common.showError(errMsg);
            });
    };

    $scope.explain = function (item) {
        _saveNotebook();

        _appendOnLast(item);

        $http.post('/agent/query', {query: 'EXPLAIN ' + item.query, pageSize: item.pageSize, cacheName: item.cache.name})
            .success(_processQueryResult(item))
            .error(function (errMsg) {
                $common.showError(errMsg);
            });
    };

    $scope.scan = function (item) {
        _saveNotebook();

        _appendOnLast(item);

        $http.post('/agent/scan', {pageSize: item.pageSize, cacheName: item.cache.name})
            .success(_processQueryResult(item))
            .error(function (errMsg) {
                $common.showError(errMsg);
            });
    };

    $scope.nextPage = function(item) {
        $http.post('/agent/query/fetch', {queryId: item.queryId, pageSize: item.pageSize, cacheName: item.cache.name})
            .success(function (res) {
                item.page++;

                item.total += item.rows.length;

                item.rows = res.rows;

                if (res.last)
                    delete item.queryId;
            })
            .error(function (errMsg) {
                $common.showError(errMsg);
            });
    };

    var _export = function(meta, rows) {
        var csvContent = "";

        if (meta) {
            csvContent += meta.map(function (col) {
                return $scope.columnToolTip(col);
            }).join(",") + '\n';
        }

        rows.forEach(function (row) {
            if (Array.isArray(row)) {
                csvContent += row.map(function (elem) {
                    return elem ? JSON.stringify(elem) : "";
                }).join(",");
            }
            else {
                var first = true;

                for (var prop of meta) {
                    if (first)
                        first = false;
                    else
                        csvContent += ",";

                    var elem = row[prop.fieldName];

                    csvContent += elem ? JSON.stringify(elem) : "";
                }
            }

            csvContent += '\n';
        });

        $common.download('application/octet-stream;charset=utf-8', 'export.csv', escape(csvContent));
    };

    $scope.exportPage = function(paragraph) {
        _export(paragraph.meta, paragraph.rows);
    };

    $scope.exportAll = function(paragraph) {
        $http.post('/agent/query/getAll', {query: paragraph.query, cacheName: paragraph.cache.name})
            .success(function (item) {
                _export(item.meta, item.rows);
            })
            .error(function (errMsg) {
                $common.showError(errMsg);
            });
    };

    $scope.columnToolTip = function (col) {
        var res = [];

        if (col.schemaName)
            res.push(col.schemaName);
        if (col.typeName)
            res.push(col.typeName);

        res.push(col.fieldName);

        return res.join(".");
    };

    $scope.resultMode = function (paragraph, type) {
        return (paragraph.result === type);
    };

    $scope.rateAsString = function (paragraph) {
        if (paragraph.rate && paragraph.rate.ruined)
            return  " " + paragraph.rate.value + paragraph.rate.unit;

        return "";
    };

    $scope.startRefresh = function (paragraph, value, unit) {
        paragraph.rate = { value: value, unit: unit, ruined: true };

        //TODO Start timer.
    };

    $scope.stopRefresh = function (paragraph) {
        paragraph.rate.ruined = false;

        //TODO Stop timer.
    };

    $scope.getter = function (value) {
        return value;
    };

    function _isNumber(arr, idx, dflt) {
        if (arr && arr.length > idx) {
            var val = arr[idx];

            if (_.isNumber(val))
                return val;
        }

        return dflt;
    }

    function _datum(key, rows) {
        var index = 0;

        var values = _.map(rows, function (row) {
            return {x: _isNumber(row, 1, index++), y: _isNumber(row, 0, 0)}
        });

        return [{key: key, values: values}];
    }

    function _insertChart(paragraph, datum, chart) {
        var chartId = 'chart-' + paragraph.id;

        $timeout(function() {
            chart.height(400);

            // Remove previous chart.
            d3.selectAll('#' + chartId + ' svg > *').remove();

            // Insert new chart.
            d3.select('#' + chartId + ' svg')
                .datum(datum)
                .call(chart)
                .attr('height', 400);

            chart.update();
        });
    }

    function _barChart(paragraph) {
        var index = 0;

        nv.addGraph(function() {
            var chart = nv.models.discreteBarChart()
                .x(function (d) {
                    return d.label;
                })
                .y(function (d) {
                    return d.value;
                });

            var values = _.map(paragraph.rows, function (row) {
                return {label: (row.length > 1) ? row[1] : index++, value: _isNumber(row, 0, 0)}
            });

            _insertChart(paragraph, [{key: 'bar', values: values}], chart);
        });
    }

    function _pieChart(paragraph) {
        var index = 0;

        nv.addGraph(function() {
            var chart = nv.models.pieChart()
                    .x(function (row) {
                        return (row.length > 1) ? row[1] : index++;
                    })
                    .y(function (row) {
                        return _isNumber(row, 0, 0);
                    })
                .showLabels(true)
                .labelThreshold(.05)
                .labelType("percent")
                .donut(true)
                .donutRatio(0.35);

            _insertChart(paragraph, paragraph.rows, chart);
        });
    }

    function _x(d) {
        return d.x;
    }

    function _y(d) {
        return d.y;
    }

    function _lineChart(paragraph) {
        nv.addGraph(function() {
            var chart = nv.models.lineChart()
                .x(_x)
                .y(_y);

            _insertChart(paragraph, _datum('Line chart', paragraph.rows), chart);
        });
    }

    function _areaChart(paragraph) {
        nv.addGraph(function() {
            var chart = nv.models.stackedAreaChart()
                .x(_x)
                .y(_y);

            _insertChart(paragraph, _datum('Area chart', paragraph.rows), chart);
        });
    }
}]);