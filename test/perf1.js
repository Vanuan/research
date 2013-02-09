var geojson_api = require("../geojson-api");
var wait = { 'send': function(data) {}};
var client = geojson_api.create_client();

      for (var i = 0; i < 100; ++i) {
        for (var j = 0; j < 100; ++j) {
          geojson_api.get_tile_data('20/' + i + '/' + j, client, wait);
        }
      }

geojson_api.close_client(client);
