var geo_json = require('./geojson-api');
var logger = require('./logger');
var connect = require('connect');
var app = connect().use(connect.static(__dirname + '/kothic-js'))
                   .use(geo_json.serve_geo_json);
connect.createServer(app).listen(8000);
