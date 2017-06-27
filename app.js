var express = require('express');
var app = express();
var cors = require('cors')
var body_parser = require('body-parser');
var session = require('express-session');
var axios = require('axios');
var nodemailer = require('nodemailer');
var promise = require('bluebird');
var pgp = require('pg-promise')({
  promiseLib: promise
});
var db = pgp({database: process.env['DB_NAME'], user: process.env['DB_USER']});
var apikey = require("apikeygen").apikey;

// Crypto configuration
var pbkdf2 = require('pbkdf2');
var crypto = require('crypto');


// Email send function
var transporter = nodemailer.createTransport({
  host: process.env['SMTP_HOST'],
  port: 465,
  secure: true,
  auth:{
    user: process.env['SMTP_USER'],
    pass: process.env['SMTP_PASSWORD']
  }
});
app.set('view engine', 'hbs');
app.use(cors());
app.use(body_parser.urlencoded({extended: false}));
app.use('/axios', express.static('node_modules/axios/dist'));
app.use('/static', express.static('public'));
app.use(session({
  secret: process.env.SECRET_KEY || 'dev',
  resave: true,
  saveUninitialized: false,
  cookie: {maxAge: 6000000}
}));

// API Get requests -- submit /api/API_KEY and get returned 1-indexed json object with top scores
// We want it 1-indexed for ease of use - so first place is at index 1
app.get('/api/:key', function (request, response, next) {
  let apiKey = request.params.key;
  let query = 'SELECT id FROM game WHERE api_key = $1';
  db.one(query, apiKey)
    .then(function(gameid){
      let query = 'SELECT * FROM g$1:value WHERE game_id = $1:value ORDER BY score DESC';
      db.query(query, gameid.id)
      .then(function(resultsArray){
         let scores = new Object;
         for (let i = 0; i < resultsArray.length; i++){
           scores[i+1] = {};      // i+1 to get the object to be 1-indexed
           scores[i+1].name = resultsArray[i].player_name;
           scores[i+1].score = resultsArray[i].score;
         }
         response.json(
           scores
         );
       })
     .catch(next);
   })
  .catch(next);
});

// API for adding scores
// gets game ID from api key and inserts username and score into game scores table
//    each game has its own table for tracking scores, in order to allow users to
//    have customized score fields (e.g. time, points, or lives)
// In addition, allows different games to have overlapping usernames with no
//    conflicts within ScoreHoard, which could happen if we stored all scores
//    in a single table
// Regarding validation, it is up to the game maker to validate scores prior to
//    calling our API, since our app has no access to the game's logic
app.get('/add/:key', function(request, response, next){
  let key = request.params.key;
  let query_game = 'SELECT id, api_key_valid FROM game WHERE api_key = $1';
  db.one(query_game, key)     // get game info from api key
  .then (function(game){
    if (game.api_key_valid){
      let user = request.query.user;
      let score = request.query.score;
      let game_id = game.id;
      let table = "g"+game_id.toString();
      let query_scores = "INSERT INTO $1:value (game_id, player_name, score) VALUES ($2:value, '$3:value', $4:value);"
      db.any(query_scores, [table, game_id, user, score])
      .catch(function(err){console.error(err)});
    }
    else if (game.api_key_valid == false) {
      console.warn('API key not valid')
      return 0
    }
  })
  response.json();
});

// Console view
app.get('/console', function(request, response, next){
  let company = request.session.company;
  let account = request.session.user || null;
  let context = {
    account: account,
    company: company,
    title: 'ScoreHoard - Admin Console'
  };
  // redirect to login if not logged in
  if (account == null) {response.redirect('/login'); return}
  // check if company is verified and send to front-end
  if (company.verified){
    context['verified'] = true;
  }
  else {
    context['verified'] = false;
  };
  // show active games owned by company, sorted alphabetically
  //    important to have active check here in backend, rather than in front-end
  //    e.g. user could use dev tools to access div if it were simply hidden
  db.any("SELECT * FROM game WHERE company_id = $1 AND active = true ORDER BY name", company.id)
  .then (function(resultsArray){
    for (i = 0; i < resultsArray.length; i++){
      if (resultsArray[i].api_key.length == 50){
        resultsArray[i]['key_present'] = true;
      }
      else {
        resultsArray[i]['key_present'] = false;
      }
    }
    context['games'] = resultsArray;
    // to show how many active keys a given company has
    context['keys'] = resultsArray.length;
    response.render('console.hbs', context)
  })
  .catch (function(err){
    console.error(err);
  })
})

// POST requests for console view
// includes:
//    adding games to database
//    deleting games  -- truly only deleting user's access to a game
//    generating API keys
app.post('/console', function(request, response, next){
  let company = request.session.company || null;
  let account = request.session.user || null;
  if (company == null || account == null) {response.redirect('/login')};
  if (company.verified){
    context[verified = true]
  }
  // generates API key, checks if unique then sends to frontend and sends
  //    verification email to user
  if (request.body.api_key_generate) {
    let id = request.session.company.id;
    let game_id = request.body.game_id;
    let query = "UPDATE game SET api_key = $1 WHERE id = $2 RETURNING name";
    unique_api_key()    // function is promise generating unique key
      .then(function(key){
        db.one(query, [key, game_id])   // sets API key and returns game name
          .then(function(obj){
            let login = request.session.user
            let name = obj.name;
            let mailOptions = {
              from:'"ScoreHoard" <donotreply@scorehoard.com>',
              to: login,
              subject: `ScoreHoard - ${name} Confirmation Email`,
              text: `Thank you for registering ${name} with ScoreHoard. May we fulfill your ScoreHoarding needs! Please click <a href="http://scorehoard.com/verify/${key}">here</a> to verify your game with us!`,
              html: `<p>Thank you for registering ${name} with ScoreHoard. May we fulfill your ScoreHoarding needs! Please click <a href="http://scorehoard.com/verify/${key}">here</a> to verify your game with us!</p>`
            };
            transporter.sendMail(mailOptions, (error, info) => {
              if (error) {
                return console.error(error);
              }
              console.log('Message send: ', info.messageId, info.response);
            });
            response.redirect('/console');
          })
          .catch(function(err){
            console.error(err)
          })
      })

  }
  // Delete user access to game by setting active flag to false
  //    Prevents 'deleted' game from returning in database call above
  else if (request.body.delete_game) {
    let name = request.body.name
    let game_id = request.body.game_id;
    let query = "UPDATE game SET active = FALSE WHERE id = \'$1:value\';"
    db.query(query, game_id)
      .then (function(){
        if (account === null) {response.redirect('/login'); return}
        response.redirect('/console');
      })
      .catch(function(err){
        console.error(err);
        response.redirect('/console');
      });
  }
  // new game
  else {
    let name = request.body.name;
    let key = 'Pending';
    let query1 = 'INSERT INTO game VALUES (DEFAULT, \'$1#\', $2, FALSE, $3, TRUE) RETURNING id'
    db.any(query1, [name, key, company.id]) // adds game to game table and returns id
      .then(function(obj){
        let table = "g" + obj[0].id.toString();
        let query2 = 'CREATE TABLE $1:value (id SERIAL NOT NULL PRIMARY KEY, game_id INTEGER DEFAULT $2, player_name VARCHAR, score INTEGER);'
        db.any(query2, [table, obj[0].id]) // creates table from game id in format gID, as in g2112
          .then(function(){
            if (account == null) {response.redirect('/login'); return}
            response.redirect('/console')
          })
          .catch(function(err){
            console.error(err)
          })
        })
      .catch(function(err){
        console.error(err)
      })
    }
  })

// handles resending verification emails
//    since company verification keys are 40 chars and API keys are 50
//    rather than make multiple views it just checks the desired key's length
app.get('/resend/', function(request, response){
  let key = request.query.key;
  let id = request.query.id;
  let company = request.session.company || null;
  if (company == null) {response.redirect('/login'); return};   // if not logged in, redirect back to login
  if (key.length == 50){   // if game key
    let login = company.login
    db.one('SELECT name FROM game WHERE api_key = $1', key)
    .then(function(obj){
      let name = obj.name
      let mailOptions = {
        from:'"ScoreHoard" <donotreply@scorehoard.com>',
        to: login,
        subject: `ScoreHoard - Resending ${name} Confirmation Email`,
        text: `Thank you for registering ${name} with ScoreHoard. May we fulfill your ScoreHoarding needs! Please copy and paste http://scorehoard.com/verify/${key} into your browser's address bar and press enter to verify your game with us!`,
        html: `<p>Thank you for registering ${name} with ScoreHoard. May we fulfill your ScoreHoarding needs! Please click <a href="http://scorehoard.com/verify/${key}">here</a> to verify your game with us!</p>`
      };
      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          return console.error(error);
        }
        console.log('Message send: ', info.messageId, info.response);
      });
      response.redirect('/console');
    })
    .catch(function(err){
      console.error(err)
    })
  } // end if game key
  else if (key.length == 40){ // **if company key
    let login = company.login
    let mailOptions = {
      from:'"ScoreHoard" <donotreply@scorehoard.com>',
      to: login,
      subject: 'ScoreHoard - Resending Account Confirmation',
      text: 'Resending Account verification',
      html: `<p>Thank you for registering an account with ScoreHoard. May we fulfill your ScoreHoarding needs! Please click <a href="http://scorehoard.com/verify/${key}">here</a> to verify your account with us!</p>`
    };
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        return console.error(error);
      }
      console.log('Message send: ', info.messageId, info.response);
    });
    response.redirect('/console');
  }
  else {
    response.redirect("/console")
  }
});

//Generates a unique API key, recursive in case of duplicates when we get popular
function unique_api_key(){
  let apiKey = apikey(50);
  var p = new Promise(function (resolve, reject) {
    db.query('SELECT count(api_key) FROM game WHERE api_key = $1', apiKey)
    .then(function(count){
      if(count[0].count == 0){
        resolve(apiKey);
      }
      else{
        unique_api_key()
         .then(function (key) {
           resolve(key);
         })
         .catch(function (err) {
           reject(err);
         });
      }
    })
    .catch(function(err){
      reject(err);
    });
  });
  return p;
}

//Generates a unique verification key, different database call
function unique_ver_key(){
  let verKey = apikey(40);
  var p = new Promise(function (resolve, reject) {
    db.query('SELECT count(verify_key) FROM company WHERE verify_key = $1', verKey)
    .then(function(count){
      if(count[0].count == 0){
        resolve(verKey);
      }
      else{
        unique_ver_key()
         .then(function (key) {
           resolve(key);
         })
         .catch(function (err) {
           reject(err);
         });
      }
    })
    .catch(function(err){
      reject(err);
    });
  });
  return p;
}

// Password creation, hashing, and verification
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
  var pass_parts = stored_pass.split('$');
  var key = pbkdf2.pbkdf2Sync( // make new hash
    password,
    pass_parts[2],
    parseInt(pass_parts[1]),
    256, 'sha256'
  );

  var hash = key.toString('hex');
  if (hash === pass_parts[3]) {
    return true
  }
  else {
    console.log('Passwords do not match')
  }
  return false;
}

// Home view
app.get('/', function(request, response){
  account = request.session.user || null;
  context = {
    account: account,
    title: 'ScoreHoard - Score Tracking API'
  };
  response.render('home.hbs', context)
})

 // Payment view -- Work in Progress
app.get('/payment', function(request, response){
  account = request.session.user || null;
  context = {account: account, title: 'ScoreHoard Payment'};
  response.render('payment.hbs', context)
})

// Log in View
app.get('/login', function(request, response){
  context = {title: 'ScoreHoard - Log In', body_class: "blue"}
  response.render('login.hbs', context)
});

// Log in mechanics
//   Includes "forgot password" feature
app.post('/login', function(request, response) {
  // Sends user a link to reset their password
  console.log(request.body.reset_pass)
  if(request.body.reset_pass){
    console.log('reset')
    let email = request.body.login;
    let query = 'SELECT * FROM company WHERE login = $1';
    db.one(query, email)
    .then(function(result){
      let login = result.login;
      let key = result.verify_key;
      let mailOptions = {
      from:'"ScoreHoard" <donotreply@scorehoard.com>',
      to: email,
      subject: 'ScoreHoard - Password Reset',
      text: 'Password Reset',
      html: `To reset your password, go to https://scorehoard.com/reset/${key}`
    };
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        return console.error(error);
      }
      console.log('Message send: ', info.messageId, info.response);
      });
      response.redirect('/');
    })
    .catch(function(err){
        if (err.name == "QueryResultError" && err.code == "0"){ // if no account in database
          context = {title: "Login", invalid: true, body_class: "blue"}
          response.render('login.hbs', context)
        }
        else {
          console.error(err);
        };
    })
  } else {
    let login = request.body.login;
    let password = request.body.password;
    // Normal Log In
    let query = "SELECT * FROM company WHERE login = $1"
    db.one(query, login)
      .then (function(company){
        // hash user input
        return {pass_success: check_pass(company.password, password), company: company}
      })
      .then (function(obj){
        if (obj.pass_success) {
          request.session.company = obj.company;
          request.session.user = login;
          response.redirect('/console');
        }
        else if (!obj.pass_success){
          context = {title: 'ScoreHoard - Login', fail: true, body_class: "blue"}

          response.render('login.hbs', context)
        }
      })
      .catch(function(err){
        if (err.name == "QueryResultError" && err.code == "0"){ // if no account in database
          context = {title: "Login", invalid: true, body_class: "blue"}
          response.render('login.hbs', context)
        }
        else {
          console.error(err);
        };
      })
    }
})

// Log out mechanics
//   Simply destroys session cookie
app.get('/logout', function(request, response, next) {
  request.session.destroy(function(err){
    if(err){console.error('Something went wrong: '+ err);}
    response.redirect('/');
  });
})

// Creating an account
app.get('/create_account', function(request, response) {
  context = {
    title: 'ScoreHoard - Create Account',
    login: request.session.user,
    anon: !request.session.user,
    body_class: "blue"
  };
  response.render('create_account.hbs', context)
});

// Mechanics for creating an account
//    Generates unique verification key, sends to user in email
//    It is required that they verify in order to use the API
app.post('/create_account', function(request, response, next){
  let login = request.body.login;
  let password = request.body.password;
  let name = request.body.name;
  let pub = request.body.public;
  if (pub == 'on') {
    pub = true;
  }
  unique_ver_key()  // promise returning unique key
  .then(function(verify_key){
    let mailOptions = {
      from:'"ScoreHoard" <donotreply@scorehoard.com>',
      to: login,
      subject: 'Confirmation Email',
      text: 'Thank you',
      html: `<p>Thank you for registering an account with ScoreHoard. May we fulfill your ScoreHoarding needs! Please click <a href="http://scorehoard.com/verify/${verify_key}">here</a> to verify your account with us!</p>`
    };
    let stored_pass = create_hash(password);
    let query = 'SELECT login FROM company WHERE login = $1';
    db.none(query, login)
    .then(function(){
      let query = 'INSERT INTO company VALUES (DEFAULT, $1, $2, $3, $4, DEFAULT, $5) RETURNING *'
      db.one(query, [login, stored_pass, pub, name, verify_key])  // returns new company
        .then(function(company){
          request.session.company = company;
          request.session.user = name;
          transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
              return console.error(error);
            }
            console.log('Message send: ', info.messageId, info.response);
          });
          response.redirect('/console');
        })
        .catch(function(err){next(err)})
      })
    .catch(function(err){
      if (err.name == "QueryResultError"){
        context = {title: "Create Account", fail: true}
        response.render('create_account.hbs', context)
      }
      else {
        console.error(err);
      };
    })
  })
  .catch(function(err){
    if (err.name == "QueryResultError"){
      context = {title: "Create Account", fail: true}
      response.render('create_account.hbs', context)
    }
    else {
      console.error(err);
    };
  })
});

// Verify account via verify key & send thanks email
app.get('/verify/:key', function(request, response, next){
  let key = request.params.key;
  if (key.length == 40) {     // company verification
    let query1 = 'UPDATE company SET verified = TRUE WHERE verify_key = $1';
    db.none(query1, key)
    .then(function() {
      let query2 = 'SELECT * FROM company WHERE verify_key = $1';
      let key = request.params.key;
      db.one(query2, key)
      .then(function(result){
        let login = result.login;
        let company = result;
        request.session.company = company;
        context = {verified: true};
        let mailOptions = {
          from:'"ScoreHoard" <donotreply@scorehoard.com>',
          to: login,
          subject: 'Thank you for verifying your account',
          text: 'Thank you',
          html: `<p>Thank you, your account has been verified. May we fulfill your ScoreHoarding needs!</p>`
        };
        transporter.sendMail(mailOptions, (error, info) => {
          if (error) {
            return console.error(error);
          }
          console.log('Message send: ', info.messageId, info.response);
        });
        response.redirect('/console')
      })
    })
  }
  else if (key.length == 50) {      // game verification
    let query1 = 'UPDATE game SET api_key_valid = TRUE WHERE api_key = $1';
    let key = request.params.key;
    db.none(query1, key)
    .then(function(){
      let query2 = 'SELECT company.id, company.login, company.public, company.name, company.verified, company.verify_key FROM company INNER JOIN game ON game.company_id = company.id WHERE game.api_key = $1';
      let key = request.params.key;
      db.one(query2, key)
      .then(function(result){
        let login = result.login;
        let company = result;
        request.session.company = company;
        let mailOptions = {
          from:'"ScoreHoard" <donotreply@scorehoard.com>',
          to: login,
          subject: 'Thank you for verifying your game',
          text: 'Thank you',
          html: `<p>Thank you, your game has been verified. May we fulfill your ScoreHoarding needs!</p>`
        };
        transporter.sendMail(mailOptions, (error, info) => {
          if (error) {
            return console.error(error);
          }
          console.log('Message send: ', info.messageId, info.response);
        });
        response.redirect('/console')
      })
    })
  }
})


// Reset password
app.get('/reset/:key', function(request, response){
  let account = request.session.user || null;
  let key = request.params.key;
  context = {
    account: account,
    key: key,
    title: 'ScoreHoard - Reset Password',
    fail: false,
    body_class: "blue"
  };
  response.render('resetpass.hbs', context);
});

app.post('/reset/:key', function(request, response){
  let key = request.params.key;
  let login = request.body.login;
  let password = request.body.newpassword;
  if(request.body.passwordreset){
    let stored_pass = create_hash(password);
    let query = 'SELECT * FROM company WHERE verify_key=$1'
    db.one(query, key)
    .then(function(result){
      if(result.login == login && request.body.newpassword == request.body.confirmpassword){
        let query = 'UPDATE company SET password=$1 WHERE login=$2'
        db.query(query, [stored_pass, login])
        .then(function(){
          response.redirect('/login');
        })
      }else{
        context = {
          key: key,
          title: 'ScoreHoard - Reset Password',
          fail: true,
          body_class: "blue"
        }
        response.render('resetpass.hbs', context);
      }

    })
    .catch(function(error){
      console.log(error);
    })
  }
});

// Change password
app.get('/changepass/:key', function(request, response){
  let company = request.session.company || null;
  let account = request.session.user || null;
  let key = request.params.key;
  if (company == null || account == null) {
    response.redirect('/login')
  } else {
    context = {
      account: account,
      key: key,
      title: 'ScoreHoard - Change Your Password',
      fail: false,
      body_class: "blue"
    };
    response.render('changepass.hbs', context);
  }
});

app.post('/changepass/:key', function(request, response){
  let account = request.session.user || null;
  let key = request.params.key;
  let currentpassword = request.body.currentpassword;
  let newpassword = request.body.newpassword;
  if(request.body.passwordchange){
    let stored_pass = create_hash(newpassword);
    let query = 'SELECT * FROM company WHERE verify_key=$1'
    db.one(query, key)
    .then(function(result){
      if(check_pass(result.password, currentpassword) && request.body.newpassword == request.body.confirmpassword){
        let login = result.login;
        let query = 'UPDATE company SET password=$1 WHERE login=$2';
        db.query(query, [stored_pass, login])
        .then(function(){
          response.redirect('/login');
        })
      }else{
        context = {
          account: account,
          key: key,
          title: 'ScoreHoard - Change Your Password',
          fail: true,
          body_class: "blue"
        }
        response.render('changepass.hbs', context);
      }

    })
    .catch(function(error){
      console.log(error);
    })
  }
});

// Change email
app.get('/changelogin/:key', function(request, response){
  let company = request.session.company || null;
  let account = request.session.user || null;
  let key = request.params.key;
  if (company == null || account == null) {
    response.redirect('/login')
  } else {
    context = {
      account: account,
      key: key,
      title: 'ScoreHoard - Change Your Email Address',
      fail: false,
      body_class: "blue"
    };
    response.render('changelogin.hbs', context);
  }
});

app.post('/changelogin/:key', function(request, response){
  let account = request.session.user || null;
  let key = request.params.key;
  let currentemail = request.body.currentaddress;
  let newemail = request.body.newaddress;
  let password = request.body.password;
  if(request.body.loginchange){
    let query = 'SELECT * FROM company WHERE verify_key=$1'
    db.one(query, key)
    .then(function(result){
      if(check_pass(result.password, password)){
        let query = 'UPDATE company SET login=$1 WHERE verify_key=$2';
        db.query(query, [newemail, key])
        .then(function(){
          response.redirect('/login');
        })
      }else{
        context = {
          account: account,
          key: key,
          title: 'ScoreHoard - Change Your Email Address',
          fail: true,
          body_class: "blue"
        }
        response.render('changelogin.hbs', context);
      }

    })
    .catch(function(error){
      console.log(error);
    })
  }
});

//FAQ View
app.get('/faq', function(request, response){
  account = request.session.user || null;
  context = {
    account: account,
    title: 'ScoreHoard - FAQ'
  }
  response.render('faq.hbs', context)
});

//Listener
app.listen(process.env['PORT'], function(){
  console.log('I am now listening... I am now sentient... Hello')
});
