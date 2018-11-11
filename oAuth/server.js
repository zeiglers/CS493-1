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

const handlebars = require('express-handlebars').create({defaultLayout:'main'});
app.engine('handlebars', handlebars.engine);
app.set('view engine', 'handlebars');

var state = '';
var accessToken = '';
const clientID = '1030018745442-2cocbetd05v2s6jhr3rtm3bq91c4lhs6.apps.googleusercontent.com';
const clientSecret = 'cV5CtjwC6TsjoCwlZP5sInwZ';

function createState(length) {
    var str = "";
    for ( ; str.length < length; str += Math.random().toString( 36 ).substr( 2 ) );
    return str.substr( 0, length );
}

app.get('/', function (req, res) {
    var context = {};
    res.render('homepage', context);
});

app.get('/authenticator', function (req, res) {
    state = createState(16);
    const redirectURL = 'https://accounts.google.com/o/oauth2/v2/auth?' + 'response_type=code&client_id=' + clientID + '&redirect_uri=https://cpcs493oauth.appspot.com/middleman&scope=email&state=' + state;
    res.redirect(redirectURL);
});

app.get('/middleman', function (req, res) {
    if (req.query.state == state) {
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
