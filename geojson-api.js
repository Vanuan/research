var pg = require('pg');
var squel = require('squel');
var settings = require('./settings.js');
var conString = settings.connectionString;
var prefix = settings.table_prefix;
var logger = require('./logger');
logger.debugLevel = logger.DEBUG;
logger.info('settings: ', settings)

var client = new pg.Client(conString);
client.connect(function(err){
  if (err) {
    logger.error('err:' + err);
  } else {
    logger.info('connected');
  }
});

function pixel_size_at_zoom(z, l) {
  /*
  Converts l pixels on tiles into length on zoom z
  */
  return Math.ceil(l* 20037508.342789244 / 256 * 2 / (Math.pow(2, z)))
}


function prepare_polygon_query(table_prefix, tags, bounds) {
  var table = table_prefix + '_polygon';
  var precision = '2'; // max decimal digits
//  var query = 'SELECT ST_AsGeoJSON((way), ' + precision + ') as ways,'
//               + tags.join() +
//               ' from ' + table + ';';
  var adp = 'true'; // ??? tags? filter?
  var names = tags.join();
  var vec = 'vec';
  var geomcolumn = 'way';
  var zoom = 10;
  var pxtolerance = 10;

  var bbox = "SetSRID('BOX3D(" + bounds[0] + " " + bounds[1] + "," +
                                 bounds[2] + " " + bounds[3] + ")'::box3d,900913)";
  var min_visible_area = Math.pow(pixel_size_at_zoom(zoom, pxtolerance), 2)/pxtolerance
 
  var buffer_way = 'ST_Buffer(way, ' + pixel_size_at_zoom(zoom, pxtolerance) + ')';
 
  var q = squel.select();
  var inside_bounds_and_visible = squel.expr().and(adp).and('way && ' + bbox).and('way_area > ' + min_visible_area);
  q = q.field(buffer_way, geomcolumn).field(names).from(table);
  q = q.where(inside_bounds_and_visible);
  q = as_geo_json(q.toString(), precision, tags);
  logger.debug(q);
  return q;
}

function as_geo_json(query, precision, fields) {
  var q = squel.select();
  q = q.field('ST_AsGeoJSON((way), ' + precision + ') as way');
  q = q.field(fields.join());
  q = q.from('(' + query + ') p')
  return q.toString();
}

function execute_query(prefix, tags, bounds, client, on_result) {
  var bbox = bbox_to_projection(bounds, 'EPSG:900913');
  var query = prepare_polygon_query(prefix, tags, bbox)
  client.query(query, function(err, result){
    if (err) {
      logger.error('err:' + err);
      return;
    } else {
      logger.info('query successfull');
    }
    var featureCollection = new FeatureCollection();
    for(var i = 0; i < result.rows.length; i++){
      var cols = result.rows[i];
      var way = result.rows[i].way;
      delete result.rows[i].way
      var properties = {};
      for(property in cols) {
        properties[property] = cols[property];
      }
      // logger.debug('row '+ i + ' ' + way)
      featureCollection.features[i] = JSON.parse(way);
      featureCollection.features[i].properties = properties;
    }
    featureCollection.bbox = bounds;
    on_result.send(featureCollection);
  });
}


function bbox_to_projection(bbox, projection) {
  if (projection != 'EPSG:900913') {
    logger.error('not supported projection');
  }
  var proj4 = require('proj4js');
  proj = new proj4.Proj("EPSG:900913");
  upper_left = proj4.transform(proj4.WGS84, proj, new proj4.Point([bbox[0], bbox[3]]));
  bottom_right = proj4.transform(proj4.WGS84, proj, new proj4.Point(bbox[1], bbox[2]));
  return [upper_left.x, bottom_right.x, bottom_right.y, upper_left.y];
}


function bbox_by_tile(z, x, y, projection) {
  coord1 = coords_by_tile(z, x, y);
  coord2 = coords_by_tile(z, x+1, y+1);
  bbox = [coord1[0], coord1[1], coord2[0], coord2[1]];
  logger.debug(z);
  logger.debug(x);
  logger.debug(y);
  logger.debug(bbox);
  return bbox;
}

function coords_by_tile(z, x, y) {
  var longitude = (x/Math.pow(2,z)*360-180);
  logger.debug(longitude);
  var n=Math.PI-2*Math.PI*y/Math.pow(2,z);
  var latitude = (180/Math.PI*Math.atan(0.5*(Math.exp(n)-Math.exp(-n))));
  logger.debug(latitude);
  return [longitude, latitude]
}

function get_bounds(tile_id) {
    var z = parseInt(tile_id.split('/')[0]);
    var x = parseInt(tile_id.split('/')[1]);
    var y = parseInt(tile_id.split('/')[2]);
    bbox = bbox_by_tile(z, x, y, "EPSG:900913")
    logger.info(z + '/' + x + '/' + y);
    return bbox;
}

function GrabData(tile_id, res){
  var bounds = get_bounds(tile_id);
  logger.info('client created');
//    execute_query(prefix, ['highway'], bounds, client, res);
  execute_query(prefix, ['amenity', 'name', 'building'], bounds, client, res);
}

function FeatureCollection(){
  this.features = new Array();
}


var http = require('http');
 
http.createServer(
  function (request, response)
  {
    var res = {};
    res.send = function(data) {
      logger.info(data.features.length + " features in database");
      // logger.debug(data);
      response.writeHead(200, {'Content-Type': 'application/javascript'});
      response.end('onKothicDataResponse(' +  JSON.stringify(data) + ');');
    };
    // /vtile/{z}/{x}/{y}.js
    var regex = /.*vtile\/(\d+\/\d+\/\d+).*/
    var tile_id = request.url.match(regex)
    logger.debug(tile_id);
    if (tile_id && tile_id.length == 2) {
      tile_id = tile_id[1];
      GrabData(tile_id, res);
    } else {
      response.writeHead(200, {'Content-Type': 'application/javascript'});
      response.end('{error}');
    }
  }
).listen(8000);
logger.info('Listenning...')
