var assert = require("assert");
var geojson_api = require("../geojson-api");
describe('geojson-api', function () {
  describe('#get_tile_data()', function(){
    it('should return in reasonable time', function () {
      for (var i = 0; i < 100; ++i) {
        for (var j = 0; j < 100; ++j) {
          var wait = { 'send': function(data) {}};
          geojson_api.get_tile_data('20/' + i + '/' + j, geojson_api.client, wait);
        }
      }
    });
  });

  describe('#query()', function(){
    it('should return in reasonable time', function () {
      var wait = { 'send': function(data) {}};
      for (var i = 0; i < 100; ++i) {
        for (var j = 0; j < 100; ++j) {
          var query = "ST_AsGeoJSON((ST_TransScale(ST_ForceRHR((way)),20037393.687242553,-20033839.365384713,2.6165333200839087,2.6165262166577854)), 2) as way, ST_AsGeoJSON((ST_TransScale(ST_ForceRHR((way)),20037393.687242553,-20033839.365384713,2.6165333200839087,2.6165262166577854)), 2) as reprpoint, 'addr:housenumber',name,building,amenity FROM (SELECT (ST_Dump(ST_Multi(ST_SimplifyPreserveTopology(ST_Buffer(way,-2),2)))).geom as way, 'addr:housenumber',name,building,amenity FROM (SELECT ST_Union(way) as way, 'addr:housenumber',name,building,amenity FROM (SELECT ST_Buffer(way, 1) AS 'way', 'addr:housenumber',name,building,amenity FROM planet_osm_polygon WHERE (true AND way && SetSRID('BOX3D(-20037393.687242553 20033839.365384713,-20037355.46873441 20033877.583996613)'::box3d,900913) AND way_area > 0.5555555555555556) AND ('addr:housenumber' != '' OR name != '' OR building != '' OR amenity != '')) p GROUP BY 'addr:housenumber',name,building,amenity) as p) p;";
          geojson_api.client.query(query, wait.send);
        }
      }
    })
  });
})

