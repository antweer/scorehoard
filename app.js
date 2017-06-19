var express = require('express');
var app = express();
var body_parser = require('body-parser');
var session = require('express-session');
var promise = require('bluebird');
var pgp = require('pg-promise')({
  promiseLib: promise
});
var db = pgp({database: 'postgres', user:'tanweer'});

var apikey = require("apikeygen").apikey;


app.set('view engine', 'hbs');

app.use(body_parser.urlencoded({extended: false}));
app.use('/static', express.static('public'));

app.listen(8000, function(){
  console.log('Listening on port 8000')
});

app.get('/', function(request, response){
  var key = apikey(40);  // generates 40 char base64 encoded key
  context = {key: key}
  response.render('home.hbs', context)
})
