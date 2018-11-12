/**************************************************************************************
Author: Conner Pappas, OSUID: 931835643
Class: CS493 - Cloud Application Development
Assignment: OAuth
Description: Create an OAuth implementation to use Google+
**************************************************************************************/
'use strict';

const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const rp = require('request-promise');
const path = require('path');
app.use(bodyParser.json());

//Using handlebars for rendering pages
const handlebars = require('express-handlebars').create({defaultLayout:'main'});
app.engine('handlebars', handlebars.engine);
app.set('view engine', 'handlebars');

//Made these global variables because I couldn't think of a better way to handle passing
//these things around from URL to URL without putting them in the body of a post request
//or in the query string of the url, and I definitely don't want the access token in the
//url, that would be bad
var state = '';
var accessToken = '';
const clientID = '1030018745442-2cocbetd05v2s6jhr3rtm3bq91c4lhs6.apps.googleusercontent.com';
const clientSecret = 'cV5CtjwC6TsjoCwlZP5sInwZ';

//create a random string for the state
function createState(length) {
    var str = "";
    for ( ; str.length < length; str += Math.random().toString(36).substr(2));
    return str.substr( 0, length );
}

app.get('/', function (req, res) {
    //Display a homepage with a link to start the process
    var context = {};
    res.render('homepage', context);
});

app.get('/authenticator', function (req, res) {
    //Using this handler to redirect the user to the authentication screen
    state = createState(16);
    const redirectURL = 'https://accounts.google.com/o/oauth2/v2/auth?' + 'response_type=code&client_id=' + clientID + '&redirect_uri=https://cpcs493oauth.appspot.com/middleman&scope=email&state=' + state;
    res.redirect(redirectURL);
});

app.get('/middleman', function (req, res) {
    //Check if the state is equal to what we originally made
    if (req.query.state == state) {
	//Using request-promise to make a post to the google api
	//to get the access token
	var options = {
	    method: 'POST',
	    uri: 'https://www.googleapis.com/oauth2/v4/token',
	    formData: {
		code: req.query.code,
		client_id: clientID,
		client_secret: clientSecret,
		redirect_uri: 'https://cpcs493oauth.appspot.com/middleman',
		grant_type:'authorization_code'
	    },
	    headers: {
		'content-type': 'application/x-www-form-urlencoded'
	    }
	};
	
	rp(options)
	    .then(function (body) {
		//redirect the user so the URL doesn't look messy
		accessToken = JSON.parse(body).access_token;
		res.redirect('/success');
	    })
	    .catch(function (err){
		res.status(500).send(err);
	    });
    }
    else {
	console.log("States don't match");
	res.status(500).send("States don't match");
    }
});

app.get('/success', function (req, res) {
    //Request from the Google+ API
    const authHeader = 'Bearer ' + accessToken;
    var options2 = {
	uri: 'https://www.googleapis.com/plus/v1/people/me',
	headers: {
	    'Authorization': authHeader
	},
	json: true
    };
    rp(options2)
	.then(function (person) {
	    //Get the data from the response and format it
	    //so it can be rendered on the page
	    var context = {};
	    context.firstName = person.name.givenName;
	    context.lastName = person.name.familyName;
	    context.profileURL = person.url;
	    context.secretState = state;
	    res.render('dataDisplay', context);
	})
	.catch(function (err) {
	    res.status(500).send('Something broke getting the profile.');
	});
});

const PORT = process.env.PORT || 8080;

app.listen(process.env.PORT || 8080, () => {
  console.log(`App listening on port ${PORT}`);
  console.log('Press Ctrl+C to quit.');
});

module.exports = app;
