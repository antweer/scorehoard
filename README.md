# [ScoreHoard](https://scorehoard.com)
### An API that tracks scores and custom stats for game makers

## Description
ScoreHoard is an API that tracks scores for videogame makers. ScoreHoard allows gamers to send scores (and the usernames associated with the scores) directly into the ScoreHoard servers, quickly being integrated into our custom database. The ScoreHoard API allows you to receive your aggregate data in easily usable JSON. 

Let ScoreHoard store your scoring data for you.  Game makers can use the ScoreHoard API to avoid the hassles of database management.  The ScoreHoard custom system allows direct access to style custom leaderboards and high scores table.  Let your imagination take root in the ScoreHoard API to create special tracking dashboards.  

## Get Started

### Create an Account

* Go to https://scorehoard.com/
* Find the “Sign Up” button on the top navigation bar 
* Fill out the form and submit
* You should receive a confirmation email shortly thereafter
* Click on the confirmation link in your email
* Tada! You now have an account on ScoreHoard

### Create an API key

#### In order to receive an API key, you must first add the game that your API key belongs to into our database:
 
* Log in to our app and navigate to the Console page
* On the console page, find the “Add a new game: “ form
* Type in the name of your game and click “Submit”
* Congratulations, your game is now in our database
 
#### Now that you’ve added your game into our database, you can generate an API key for it:
 
* Click on the “Generate API key” button inside the panel specific to the game you want to create an API key for
* Once you API key has been generated, it will be displayed in the panel specific to your game and a confirmation email will be sent to you for verification
* Your API key will be inactive until it has been verified through the link sent to you in the confirmation email
* Once your API key is active, you may start making API calls to it!

### Using the API to feed us your game data
 
#### Now that you have activated your API key, you can start using it to send us data from your game by making Add Requests!

#### A sample Add Request:
```
https://scorehoard.com/add/[key]?user=[username]&score=[score]
```
 
* Please substitute [key] with your unique API key, [username] with the username of the player you’re sending data for (don’t quote the username!), and [score] as the numerical score associated with the username that you sent in.

### Using the API to request the data from your game
 
#### If you’ve activated your unique API key and have used it to feed us data from your game, then you can start making Leaderboard Requests!
 
#### A sample Leaderboard Request:
```
https://scorehoard.com/api/[key]
```

* Please substitute [key] with your unique API key. This API call will return all data that has been sent to us through Add Requests associated with your unique API key in JSON format. The data will be ordered by descending scores.

## Built With

### Backend:
* Javascript
   * [Node.js](https://nodejs.org/en/)  
   * [Express.js](https://expressjs.com/)  

### Frontend:
* Javascript
   * [Handlebars.js](http://handlebarsjs.com/)  
* CSS3
   * [Bootstrap](http://getbootstrap.com/)  
* HTML5

### Database:
* [PostgreSQL](https://www.postgresql.org/)


## Features

### MVP:

* ~~Datebase architecture~~
* ~~Functional API call that returns leaderboard~~
* ~~Functional API call that adds a username and the score associated with that user to the leaderboard~~
* ~~Each leaderboard is associated with a unique API key~~
* ~~Web UI that allows user account creation/verification~~
* ~~Web UI feature that allows API key generation/verification/deletion for verified users~~
* ~~Deploy Web UI~~
* ~~Add SSL certification~~
* ~~FAQ/Documentation that provides an overview of how to use our API~~
* ~~Logo~~

### Stretch Goals:

* ~~Responsive Design~~
* Overhaul database architecture to be optimized
* Allow users to modify the parameters for their leaderboards e.g. allow more game stats than username and score
* Web UI feature that allows API key reset
* Payment options for premium features

## Contributors

* [Eric Schow](https://github.com/ericmschow)
* [Gene Grilli](https://github.com/g-grilli)
* [Jordan Benner](https://github.com/JordanBenner)
* [Tanweer Rajwani](https://github.com/antweer)
