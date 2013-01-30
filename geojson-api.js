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
  var query = 'SELECT ST_AsGeoJSON((way), ' + precision + ') as ways,'
               + tags.join() +
               ' from ' + table + ';';
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
  q = q.field(buffer_way, geomcolumn).field(names).from(table).where(inside_bounds_and_visible)
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
  var query = prepare_polygon_query(prefix, tags, bounds)
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
      var properties = [];
      for(property in cols) {
        var pair = {};
        pair[property] = cols[property];
        properties.push(pair);
      }
      logger.debug('row '+ i + ' ' + way)
      featureCollection.features[i] = JSON.parse(way);
      featureCollection.features[i].properties = properties;
    }
    on_result.send(featureCollection);
  });
}

function get_bounds(tile_id) {
    return [-20037508.3428, -20037508.3428, 20037508.3428, 20037508.3428];
}

function GrabData(tile_id, res){
  var bounds = get_bounds(tile_id);
  logger.info('client created');
//    execute_query(prefix, ['highway'], bounds, client, res);
  execute_query(prefix, ['amenity'], bounds, client, res);
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
      logger.debug(data);
      response.writeHead(200, {'Content-Type': 'application/javascript'});
      response.end('onKothicDataResponse(' +  JSON.stringify(data) + ');');
    };
    GrabData([0,0,0], res);
  }
).listen(8000);
logger.info('Listenning...')
