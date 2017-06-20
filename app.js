var express = require('express');
var app = express();
var body_parser = require('body-parser');
var session = require('express-session');
var axios = require('axios');
var promise = require('bluebird');
var pgp = require('pg-promise')({
  promiseLib: promise
});
var db = pgp({database: 'scorehoard', user:'postgres'});   // TODO update database info
var apikey = require("apikeygen").apikey;

// password
var pbkdf2 = require('pbkdf2');
var crypto = require('crypto');
var salt = crypto.randomBytes(20).toString('hex');
var password = 'some-password';
var key = pbkdf2.pbkdf2Sync(
  password, salt, 36000, 256, 'sha256'
);
var hash = key.toString('hex');

app.set('view engine', 'hbs');

app.use(body_parser.urlencoded({extended: false}));
app.use('/axios', express.static('node_modules/axios/dist'));
app.use('/static', express.static('public'));
app.use(session({
  secret: process.env.SECRET_KEY || 'dev',
  resave: true,
  saveUninitialized: false,
  cookie: {maxAge: 600000}
}));

//API Get requests - work in progress
app.get('/api/:name', function (request, response, next) {
  var dbname = request.params.name;
  var valid_names = ['scores'];
  if (valid_names.indexOf(dbname) >= 0) {
    db.any(`SELECT player_name, score FROM ${dbname} WHERE game_id = 1 ORDER BY score DESC`)
      .then(function(resultsArray){
        result1name = resultsArray[0].player_name;
        result2 = resultsArray[1];
        response.json(
          {winner: result1name, second: result2}
        );
      })
      .catch(next);
  }
});

//Passwords
function create_hash (password) {
  var salt = crypto.randomBytes(20).toString('hex');
  var key = pbkdf2.pbkdf2Sync(
    password, salt, 36000, 256, 'sha256'
  );
  var hash = key.toString('hex');
  var stored_pass = `pbkdf2_sha256$36000$${salt}$${hash}`;
  return stored_pass;
}

function check_pass (stored_pass, password){
  // checking a password
  var pass_parts = stored_pass.split('$');
  var key = pbkdf2.pbkdf2Sync( // make new hash
    password,
    pass_parts[2],
    parseInt(pass_parts[1]),
    256, 'sha256'
  );

  var hash = key.toString('hex');
  if (hash === pass_parts[3]) {
    console.log('Passwords Matched!');
    return true
  }
  else {
    console.log('No match')
  }
  return false;
}

// HOME
app.get('/', function(request, response){
  context = {};
  response.render('home.hbs', context)
})

// NEW API KEY LOGIC
app.post('/', function(request, response, next){
  var key = apikey(50);  // generates 40 char base64 encoded key
  var account = request.session.user;
  db.one("SELECT id FROM company WHERE name = $1;", account)
    .then(function(){
      api_key = key
    })
    .catch(function(err){
      next('Sorry, an error occurred: \n' + err);
    })
  context = {key: key}
  response.render('home.hbs', context)
})

//login page
app.get('/login', function(request, response){
  context = {title: 'Login'}
  response.render('login.hbs', context)
});

//login mechanics
app.post('/login', function(request, response) {
  let username = request.body.username;
  let password = request.body.password;
  let query = "SELECT password FROM company WHERE name = $1"
  db.one(query, username)
    .then (function(stored_pass){
      // hash user input
      return check_pass(stored_pass.password, password)
    })
    .then (function(pass_success){
      if (pass_success) {
        request.session.user = username;
        response.redirect('/');
      }
      else if (!pass_success){
        context = {title: 'Login', fail: true}
        response.render('login.hbs', context)
      }
    })
})

app.get('/logout', function(request, response, next) {
  request.session.destroy(function(err){
    if(err){console.error('Something went wrong: '+ err);}
    response.redirect('/');
  });
})

//Creating an account - We'll have to add verification
app.get('/create_account', function(request, response) {
  context = {title: 'Create account', user: request.session.user, anon: !request.session.user};
  response.render('create_account.hbs', context)
});

app.post('/create_account', function(request, response, next){
  let name = request.body.username;
  let password = request.body.password;
  let email = request.body.email;
  let stored_pass = create_hash(password);
  let query = 'INSERT INTO company VALUES (DEFAULT, $1, $2, 1, $3)'
  db.none(query, [name, email, stored_pass])
    .then(function(){
      request.session.user = name
      response.redirect('/');
    })
    .catch(function(err){next(err)})
});

app.listen(8000, function(){
  console.log('Listening on port 8000')
});