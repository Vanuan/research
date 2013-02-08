Install Nodejs

Install npm:

sudo apt-get install npm

Install dependencies:

* npm install

Setup a PostGIS database with OSM data (not covered in this README)

Copy settings.js.example to settings.js and edit user name, password and database name.

Edit table prefix if needed.

Run:

    node app.js

Development dependencies:

* npm install --dev -g

Run as developer:

* nodemon app.js
