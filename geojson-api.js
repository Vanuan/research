var pg = require('pg');
var settings = require('./settings.js');
var conString = settings.connectionString;
var prefix = settings.table_prefix;
console.log('settings: ', settings)

function GrabData(bounds, res){
  var client = new pg.Client(conString);
  console.log('client created');
  client.connect(function(err){
    if (err) {
      console.log('err:' + err);
    } else {
      console.info('connected');
    }
    var moisql = 'SELECT ST_AsGeoJSON(way) as ways from '
                  + prefix + '_line;'

    client.query(moisql, function(err, result){
      if (err) {
        console.log('err:' + err);
      } else {
        console.info('query successfull');
      }
      var featureCollection = new FeatureCollection();
  
      for(i=0; i<result.rows.length; i++){
        var ways = result.rows[i].ways;
        // console.info('row '+ i + ': %o', ways)
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
  //console.log(data)
  console.log("%d features in database", data.features.length)
  process.exit(code=0);
};
GrabData([1,1], res);
