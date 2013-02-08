var assert = require("assert");
var geojson_api = require("../geojson-api");
describe('geojson-api', function () {
  describe('#get_tile_data()', function(){
    it('should return in reasonable time', function () {
      var wait = { 'send': function() {}};
      for (var i = 0; i < 100; ++i) {
        for (var j = 0; j < 100; ++j) {
          geojson_api.get_tile_data('20/' + i + '/' + j, wait);
        }
      }
    })
  });
})

