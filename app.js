var express = require('express');
var app = express();
var body_parser = require('body-parser');
var session = require('express-session');
var promise = require('bluebird');
var pgp = require('pg-promise')({
  promiseLib: promise
});
var db = pgp({database: 'postgres', user:'tanweer'});

app.set('view engine', 'hbs');

app.use(body_parser.urlencoded({extended: false}));
app.use('/static', express.static('public'));

app.listen(8000, function(){
  console.log('Listening on port 8000')
});