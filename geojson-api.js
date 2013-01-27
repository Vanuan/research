var pg = require('pg');
var settings = require('./settings.js');
var conString = settings.connectionString;
var prefix = settings.table_prefix;
var logger = require('./logger');
logger.debugLevel = logger.INFO;
logger.info('settings: ', settings)

function GrabData(bounds, res){
  var client = new pg.Client(conString);
  logger.info('client created');
  client.connect(function(err){
    if (err) {
      logger.error('err:' + err);
    } else {
      logger.info('connected');
    }
    var precision = '2'; // max decimal digits
    var moisql = 'SELECT ST_AsGeoJSON((way), ' + precision + ') as ways, highway from '
                  + prefix + '_line;'

    client.query(moisql, function(err, result){
      if (err) {
        logger.error('err:' + err);
      } else {
        logger.info('query successfull');
      }
      var featureCollection = new FeatureCollection();
  
      for(i=0; i<result.rows.length; i++){
        var ways = result.rows[i].ways;
        logger.debug('row '+ i + ' ' + ways)
        featureCollection.features[i] = JSON.parse(ways);
     }

     res.send(featureCollection);
   });

  });
}


function FeatureCollection(){
  this.type = 'FeatureCollection';
  this.features = new Array();
}


var res = {};
res.send = function(data) {
  logger.info(data.features.length + " features in database")
  process.exit(code=0);
};
GrabData([1,1], res);
