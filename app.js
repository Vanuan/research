var geo_json = require('./geojson-api');
var logger = require('./logger');
var connect = require('connect');
var app = connect().use(connect.static(__dirname + '/kothic-js'))
                   .use(geo_json.serve_geo_json);
try {
  var settings = require('./settings');
  var port = settings.port;
  var ip = settings.ip;
} catch(e) {
  var port = process.env.OPENSHIFT_INTERNAL_PORT;
  var ip = process.env.OPENSHIFT_INTERNAL_IP;
}

connect.createServer(app).listen(port, ip);
