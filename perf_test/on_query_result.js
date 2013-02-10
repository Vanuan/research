var agent = require('webkit-devtools-agent');

var geojson_api = require('../geojson-api');
var result = {"command":"SELECT","rowCount":2,"oid":null,"rows":[{"way":"{\"type\":\"Polygon\",\"coordinates\":[[[-78.48,160.07],[-39.95,190.77],[49.65,78.32],[11.12,47.6],[-78.48,160.07]]]}","reprpoint":"{\"type\":\"Polygon\",\"coordinates\":[[[-78.48,160.07],[-39.95,190.77],[49.65,78.32],[11.12,47.6],[-78.48,160.07]]]}","addr:housenumber":"14б","name":null,"building":"yes","amenity":null},{"way":"{\"type\":\"Polygon\",\"coordinates\":[[[-15.8,-82.51],[136.3,31.7],[232.14,-95.94],[80.04,-210.17],[-15.8,-82.51]]]}","reprpoint":"{\"type\":\"Polygon\",\"coordinates\":[[[-15.8,-82.51],[136.3,31.7],[232.14,-95.94],[80.04,-210.17],[-15.8,-82.51]]]}","addr:housenumber":"16","name":null,"building":"yes","amenity":null}]};
var err = null;
var bounds = {};
var intscalefactor = 10;
var on_result = {};
on_result.send = function (feature) {
//  console.log(JSON.stringify(feature))
}

for (var i = 0; i < 10000; ++i) {
//while(true) {

//function recurse() {
  geojson_api.on_query_result(err, result, on_result, bounds, intscalefactor);
//  setTimeout(recurse, 0.1);
}

//recurse();


