var assert = require("assert");
var geojson_api = require("../geojson-api");
describe('geojson-api', function () {
  describe('#get_bounds()', function(){
    it('should return valid bounds by tile_id', function () {
      assert.deepEqual({"bounds":[-180.0, -85.0511287798,
                                  180.0, 85.0511287798],
                        "z":0,"x":0,"y":0},
                       geojson_api.get_bounds('0/0/0')
      );
      assert.deepEqual({"bounds":[0.0, -85.0511287798,
                                  180.0, -0],
                        "z":1,"x":1,"y":1},
                       geojson_api.get_bounds('1/1/1')
      );
    })
  });
  describe('#coords_by_tile', function() {
    // http://wiki.openstreetmap.org/wiki/Slippy_map_tilenames
    it('should return coords by tile number', function () {
      assert.deepEqual([0, 0], geojson_api.coords_by_tile(1, 1, 1));
      assert.deepEqual([180,-85.0511287798], geojson_api.coords_by_tile(1, 2, 2));
    });
  });
  describe('#google_coords_by_tile', function() {
    it('should return EPSG:3857-projected coords by tile number', function () {
      assert.deepEqual([0, 0], geojson_api.google_coords_by_tile(1, 1, 1));
      assert.deepEqual([180,-85.0511287798], geojson_api.google_coords_by_tile(1, 2, 2));
    });
  });

  describe('#transcale', function () {
    it('should return transscale query', function () {
        assert.equal('ST_TransScale(ST_ForceRHR(way),-3420098.3935961006,-5846515.419476688,16.353330869413554,16.353330652228937)',
                     geojson_api.transcale('way',
                 [3420098.3935961006, 5846515.419476688, 3420709.8898154246, 5847126.915704133],
                   10000))
    });
  });
})

