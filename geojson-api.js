var anydb = require('any-db');
var squel = require('squel');
try {
  var settings = require('./settings.js');
}
catch(e) {
  var settings = {"connectionString":
                  "tcp://" + process.env.OPENSHIFT_POSTGRESQL_DB_USERNAME +
                  ":" + process.env.OPENSHIFT_POSTGRESQL_DB_PASSWORD +
                  "@" + process.env.OPENSHIFT_POSTGRESQL_DB_HOST + ":" +
                  process.env.OPENSHIFT_POSTGRESQL_DB_PORT + "/osm1",
                  "table_prefix": "planet_osm"
                 };
}

var conString = settings.connectionString;
var create_client = function () {
  var client = anydb.createPool(conString.replace('tcp', 'postgres'),
                                {min: 10, max: 10});
  return client;
};
exports.create_client = create_client;

var close_client = function (client) { client.close(); }
exports.close_client = close_client;

var prefix = settings.table_prefix;
var logger = require('./logger');
var proj4 = require('proj4js');
logger.debugLevel = logger.WARN;
logger.info('settings: ', settings)


function pixel_size_at_zoom(z, l) {
  /*
  Converts l pixels on tiles into length on zoom z
  */
  return Math.ceil(l* 20037508.342789244 / 256 * 2 / (Math.pow(2, z)))
}


function prepare_polygon_query(table_prefix, tags, bounds, zoom, intscalefactor) {
  var table = table_prefix + '_polygon';
  var precision = '2'; // max decimal digits
  var adp = 'true'; // ??? tags? filter?
  var names = '"' + tags.join('","') + '"';
  var vec = 'vec';
  var geomcolumn = 'way';
  var pxtolerance = 1.8;

  logger.debug(bounds)
  var bbox = "SetSRID('BOX3D(" + bounds[0] + " " + bounds[1] + "," +
                                 bounds[2] + " " + bounds[3] + ")'::box3d,900913)";
  var min_visible_area = Math.pow(pixel_size_at_zoom(zoom, pxtolerance), 2)/pxtolerance;
 
  var buffer_way = 'ST_Buffer(way, ' + pixel_size_at_zoom(zoom+1, pxtolerance) + ')';
  var inside_bounds_and_visible = squel.expr().and(adp).and('way && ' + bbox).and('way_area > ' + min_visible_area);
  var q = squel.select();
  q = q.field(buffer_way, geomcolumn).field(names).from(table);
  q = q.where(inside_bounds_and_visible);
  var inter = intersection(bbox);
  var point = point_on();
  var trans1 = transcale(inter, bounds, intscalefactor);
  var trans2 = transcale(point, bounds, intscalefactor);
  var skip_without_tags = squel.expr();
  for (var tag in tags) {
    skip_without_tags = skip_without_tags.or("'" + tags[tag] + "' != ''");
  }
  q = q.where(skip_without_tags);
  var union = squel.select().field('ST_Union(way) as way').field(names);
  union = union.from('(' + q.toString() + ') p').group(names);
  var simplify = squel.select().field("(ST_Dump(ST_Multi(ST_SimplifyPreserveTopology(ST_Buffer(way,-2),2)))).geom as way").field(names);
  simplify = simplify.from('(' + union.toString() + ') as p');
  q = as_geo_json(trans1, trans2, simplify.toString(), precision, names);
  logger.debug(q);
  return q;
}

function as_geo_json(field1, field2, from_query, precision, fields) {
  var q = squel.select();
  q = q.field(as_geo_json_field(field1, precision, 'way'));
  q = q.field(as_geo_json_field(field2, precision, 'reprpoint'));
  q = q.field(fields);
  q = q.from('(' + from_query + ') p');
  return q.toString();
}

function as_geo_json_field(field, precision, as) {
  return 'ST_AsGeoJSON((' + field + '), ' + precision + ') as ' + as;
}

function intersection(bbox) {
  var intersection = 'way'; //('ST_Intersection(way,' + bbox + ')');
  return intersection;
}

function point_on() {
  var intersection = 'way';//'ST_PointOnSurface(way)';
  return intersection;
}

exports.transcale = transcale;
function transcale(to_scale, bbox_p, intscalefactor) {
  var rhr = 'ST_ForceRHR(' + to_scale + ')';
  var transcale = 'ST_TransScale(' + rhr + ',' +
                     -bbox_p[0] + ',' + -bbox_p[1] + ',' +
                     intscalefactor/(bbox_p[2]-bbox_p[0]) + ',' +
                     intscalefactor/(bbox_p[3]-bbox_p[1]) + ')';
  return transcale;
}

function execute_query(prefix, tags, bounds, client, on_result) {
  var bbox = bbox_to_projection(bounds.bounds, 'EPSG:900913');
  var intscalefactor = 100;
  var query = prepare_polygon_query(prefix, tags, bbox, bounds.z, intscalefactor);
  client.query(query, function (err, result) {
    on_query_result(err, result, on_result, bounds, intscalefactor);
  });
}

function on_query_result(err, result, on_result, bounds, intscalefactor) {
  process.nextTick(function () {
  if (err) {
    logger.error('err:' + err);
    return;
  } else {
    logger.info('query successfull');
  }
  var featureCollection = new FeatureCollection();
  for(var i = 0; i < result.rows.length; i++){
    var cols = result.rows[i];
    var way = JSON.parse(cols.way);
    var reprpoint = cols.reprpoint;
    if (way.type == 'GeometryCollection') {
      continue;
    }
    var properties = {};
    for(property in cols) {
      if (property == 'way' || property == 'reprpoint' ||
          cols[property] == null) {
        continue;
      }
      properties[property] = cols[property];
    }
    var feature = way;
    logger.debug(way.coordinates);
    feature.properties = properties;
    if (reprpoint) {
      feature.reprpoint = JSON.parse(reprpoint)["coordinates"];
    }
    featureCollection.features.push(feature);
  }
  featureCollection.bbox = bounds.bounds;
  featureCollection.granularity = intscalefactor;

  process.nextTick(function () {
    on_result.send(featureCollection, bounds.z, bounds.x, bounds.y)
  });
  });
}
exports.on_query_result = on_query_result;

function bbox_to_projection(bbox, projection) {
  if (projection != 'EPSG:900913') {
    logger.error('not supported projection');
  }
  var proj = new proj4.Proj("EPSG:900913");
  var upper_left = proj4.transform(proj4.WGS84, proj, new proj4.Point([bbox[0], bbox[3]]));
  var bottom_right = proj4.transform(proj4.WGS84, proj, new proj4.Point(bbox[2], bbox[1]));

  return [upper_left.x,
          bottom_right.y,
          bottom_right.x,
          upper_left.y
];
}


function bbox_by_tile(z, x, y, projection) {
  var coord1 = coords_by_tile(z, x, y);
  var coord2 = coords_by_tile(z, x+1, y+1);
  var bbox = [coord1[0], coord2[1], coord2[0], coord1[1]];
  logger.debug(z);
  logger.debug(x);
  logger.debug(y);
  logger.debug(bbox);
  return bbox;
}

function sinh (arg) {
  return (Math.exp(arg) - Math.exp(-arg)) / 2;
}

function rad_to_deg(rad) {
  return rad * 180.0 / Math.PI;
}

exports.coords_by_tile = coords_by_tile;
/**
 * returns WSG84 coordinates by the tile number
 */
function coords_by_tile(z, x, y) {
  var longitude = (x/Math.pow(2,z)*360-180);
  logger.debug(longitude);
  var n = Math.pow(2, z);
  n = Math.PI * (1 - (2 * y / n));
  var latitude = rad_to_deg(Math.atan(sinh(n)) );
  logger.debug(latitude);
  return [round_to(longitude, 10), round_to(latitude, 10)]
}


function lat_coord_by_tile(zoom, tile_number) {
  var min = -180;
  var max = 180;
  return coord_by_tile(zoom, tile_number, min, max);
}
function long_coord_by_tile(zoom, tile_number) {
  var min = 85.0511287798;  // arctan(sinh(π))
  var max = -85.0511287798;
  return coord_by_tile(zoom, tile_number, min, max);
}

function coord_by_tile(zoom, tile_number, min, max) {
  var count = Math.pow(2, zoom);
  return tile_number / count * (max-min) + min;
}

exports.google_coords_by_tile = google_coords_by_tile;
/**
 * returns EPSG:3857-projected coordinates (Spherical Mercator)
 * by the tile number
 */
function google_coords_by_tile(z, x, y) {
  var latitude = lat_coord_by_tile(z, x);
  var longitude = long_coord_by_tile(z, y);
  return [latitude, longitude];
}

function round_to(num, precision) {
  return Math.round(num*Math.pow(10, precision))/Math.pow(10, precision);
}

exports.get_bounds = get_bounds;
function get_bounds(tile_id) {
    var z = parseInt(tile_id.split('/')[0]);
    var x = parseInt(tile_id.split('/')[1]);
    var y = parseInt(tile_id.split('/')[2]);
    var bbox = {};
    bbox.bounds = bbox_by_tile(z, x, y, "EPSG:900913");
    bbox.z = z;
    bbox.x = x;
    bbox.y = y;
    logger.info(z + '/' + x + '/' + y);
    return bbox;
}

function GrabData(tile_id, client, res){
  var response  = res.response;
  response.writeHead(200, res.headers);
  var bounds = get_bounds(tile_id);
  var z = parseInt(tile_id.split('/')[0]);
  var x = parseInt(tile_id.split('/')[1]);
  var y = parseInt(tile_id.split('/')[2]);
  var tags =['addr:housenumber', 'name', 'building', 'amenity'];
//  execute_query(prefix, tags, bounds, client, res);
  execute_query(prefix, tags, bounds, client, {
    'send': function(data, z, x, y) {
      var result = 'onKothicDataResponse(' +  JSON.stringify(data) +
                   ',' + z + ',' + x + ',' + y +
                   ');';
//      var result = 'onKothicDataResponse({"features":[{"type":"Polygon","coordinates":[[[8.63,73.2],[30.51,164.21],[57.83,157.64],[35.94,66.63],[8.63,73.2]]],"properties":{"addr:housenumber":"148а/2","building":"yes"},"reprpoint":[[[8.63,73.2],[30.51,164.21],[57.83,157.64],[35.94,66.63],[8.63,73.2]]]},{"type":"Polygon","coordinates":[[[-15.37,-16.27],[6.99,63.12],[33.45,55.68],[11.08,-23.71],[-15.37,-16.27]]],"properties":{"addr:housenumber":"148а/1","building":"yes"},"reprpoint":[[[-15.37,-16.27],[6.99,63.12],[33.45,55.68],[11.08,-23.71],[-15.37,-16.27]]]}],"bbox":[30.7287597656,46.4033026733,30.7294464111,46.4037761667],"granularity":100},' + z + ',' + x + ',' + y +');'
/*      function writeChunk() {
        if (current < chunkCount) {
            current++;

            if (response.write(longBuffer)) {
                process.nextTick(writeChunk);
            } else {
                response.one('drain', writeChunk);
            }
        } else {
            response.end();
        }
    }*/
  response.write(result);
  response.end();
    }
  });

//  res.request = request;
//  res.headers = headers;
//  res.response = response;

}

function FeatureCollection(){
  this.features = new Array();
}

function sendResponse(headers, response, responseBuffer) {
  setTimeout(function() {
    response.writeHead(200, headers);
    response.end(responseBuffer);
  }, 2);
}


var http = require('http');
var zlib = require('zlib');

var db_client = null;

    var res = {};
    res.send = function(data, z, x, y) {
      logger.info(data.features.length + " features in database");
      var responseString = 'onKothicDataResponse(' +  JSON.stringify(data) +
                   ',' + z + ',' + x + ',' + y +
                   ');';
      var acceptEncoding = res.request.headers['accept-encoding'];
      if (!acceptEncoding) {
        acceptEncoding = '';
      }
      // Note: this is not a conformant accept-encoding parser.
      // See http://www.w3.org/Protocols/rfc2616/rfc2616-sec14.html#sec14.3
      if (acceptEncoding.match(/\bdeflate\b/)) {
        res.headers['content-encoding'] = 'deflate';
        res.response.writeHead(200, res.headers);
        zlib.deflate(responseString, function(err, responseBuffer) {
          if (!err) {
            sendResponse(res.headers, res.response, responseBuffer);
          }
        });
      } else if (acceptEncoding.match(/\bgzip\b/)) {
        res.headers['content-encoding'] = 'gzip';
        zlib.gzip(responseString, function(err, responseBuffer) {
          if (!err) {
            sendResponse(res.headers, res.response, responseBuffer);
          }
        });
      } else {
        sendResponse(res.headers, res.response, responseString);
      }
    };

var serve_geo_json = function (request, response) {
    if (db_client == null) {
      db_client = create_client();
    }
    var headers = {'Content-Type': 'application/javascript; charset=utf-8',
                   'Cache-Control': 'public',
                   'Last-Modified': new Date('2011','01','01').toUTCString()}
    // /vtile/{z}/{x}/{y}.js
    var regex = /.*vtile\/(\d+\/\d+\/\d+).*/
    var tile_id = request.url.match(regex)
    logger.debug(tile_id);
    if (tile_id && tile_id.length == 2) {
      tile_id = tile_id[1];
      var allow304 = request.headers['If-Modified-Since'];
      allow304 = Date.parse(allow304);
      if (allow304 > (new Date('2011','01','01'))) {
        response.writeHead(304, null);
        response.end('');
        return;
      } else {
        res.request = request;
        res.headers = headers;
        res.response = response;
        GrabData(tile_id, db_client, res);
      }
    } else {
      response.writeHead(200, {'Content-Type': 'application/javascript'});
      response.end('{error}');
    }
  };


exports.get_tile_data = GrabData;



exports.serve_geo_json = serve_geo_json;
