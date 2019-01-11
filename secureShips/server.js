/**************************************************************************************
Author: Conner Pappas, OSUID: 931835643
Class: CS493 - Cloud Application Development
Assignment: Advanced API
Description: Create a restful API that we can run tests against, status codes improved
**************************************************************************************/
'use strict';

const express = require('express');
var shipRouter = express.Router();
var loginRouter = express.Router();
var userRouter = express.Router();
var signupRouter = express.Router();
const app = express();
const Datastore = require('@google-cloud/datastore');
const bodyParser = require('body-parser');
const json2html = require('json-to-html');
const jwt = require('express-jwt');
const jwksRsa = require('jwks-rsa');
const rp = require('request-promise');
const ships = "SHIPS";
const projectID = 'CPCS493LoginShips';
const clientID = '';
const clientSecret = '';

const datastore = new Datastore({projectID:projectID});
app.use(bodyParser.json());

const checkJwt = jwt({
  secret: jwksRsa.expressJwtSecret({
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 5,
    jwksUri: ``
  }),

  audience: clientID,
  issuer: ``,
  algorithms: ['RS256']
});

/**************************************************************************************
Method: postShip
Parameters: name - name of the new ship
            type - type of the new ship
            length - length of the new ship
Description: Create a new ship from a post request and save it to the datastore
**************************************************************************************/
function postShip (name, type, length, owner, ownerID) {
    var key = datastore.key(ships);
    const ship = {
	"name": name,
	"type": type,
	"length": length,
	"owner": owner,
	"ownerID": ownerID
    };
    const newShip = {
	key: key,
	data: ship
    };

    return datastore.insert(newShip).then(() => {
	return key});
}

/**************************************************************************************
Method: shipIdAssign
Parameters: shippy - a ship that was received from the datastore that we need to add
                     an id to before sending it to the client
Description: Add the id of a ship to its properties
**************************************************************************************/
function shipIdAssign (shippy) {
    var ship = {
	"name": shippy.name,
	"type": shippy.type,
	"length": shippy.length,
	"owner": shippy.owner,
	"id": shippy[Datastore.KEY].id,
	"self": "https://cpcs493loginships.appspot.com/ships/" + shippy[Datastore.KEY].id
    };
    return ship;
}

/**************************************************************************************
Method: getShips
Parameters: none
Description: Request the ships from the datastore
**************************************************************************************/
function getShips () {
    let shipQuery = datastore.createQuery(ships);
    
    return datastore.runQuery(shipQuery).then(results => {
	var resultingShips = results[0].map(shipIdAssign);
	return resultingShips;
    });
}

/**************************************************************************************
Method: getUsersShips
Parameters: none
Description: Request the ships from the datastore
**************************************************************************************/
function getUsersShips (ownerID) {
    let shipQuery = datastore.createQuery(ships).filter('ownerID', '=', ownerID);
    
    return datastore.runQuery(shipQuery).then(results => {
	var resultingShips = results[0].map(shipIdAssign);
	return resultingShips;
    });
}

/**************************************************************************************
Method: getShip
Parameters: shipID - ID of the specific ship requested
Description: Get a specific ship from the datastore
**************************************************************************************/
function getShip (shipID) {
    const key = datastore.key([ships, parseInt(shipID,10)]);
    const shipQuery = datastore.createQuery(ships).filter('__key__', '=', key);
    return datastore.runQuery(shipQuery).then(results => {
	var resultingShip = results[0];
	return resultingShip;
    });
}

/**************************************************************************************
Method: deleteShip
Parameters: shipID - ID of the ship to delete
Description: Delete a ship from the datastore
**************************************************************************************/
function deleteShip (shipID) {
    const key = datastore.key([ships, parseInt(shipID,10)]);
    return datastore.delete(key).then(() => {});
}

/********************END OF HELPER FUNCTIONS*******************************/

/*---------------START Ship Routing Functions---------------*/
// Get all ships
shipRouter.get('/', function (req, res) {
    const accepted = req.get('Accept');
    getShips(req).then((ships) => {
	if (ships.length == 0) {
	    res.status(404).send('No ships found');
	}
	else if (accepted !== 'application/json' && accepted !== 'text/html') {
	    res.status(406).send('No form acceptable');
	}
	else if (accepted === 'application/json') {
	    res.status(200).json(ships);
	}
	else if (accepted === 'text/html') {
	    res.status(200).send(json2html(ships).slice(1,-1));
	}
	else {
	    res.status(500).send('Something went really wrong.');
	}
    });
});

// Create a new ship
shipRouter.post('/', checkJwt, function (req, res) {
    if (req.get('content-type') !== 'application/json') {
	res.status(415).send('Server only accepts application/json data, you ding dong.');
    }
    else {
	postShip(req.body.name, req.body.type, req.body.length, req.user.nickname, req.user.sub.substring(6)).then((key) => {
	    res.location(req.protocol + "://" + req.get('host') + req.baseUrl + '/' + key.id);
	    const sendID = {"id": key.id};
	    res.status(201).send(sendID);
	});
    }
});

// Delete route for ships without the specified ID
shipRouter.delete('/', function (req, res) {
    res.set('Accept', 'GET, POST');
    res.status(405).end();
});

// Delete a ship
shipRouter.delete('/:shipID', checkJwt, function (req, res) {
    getShip(req.params.shipID).then(ship => {
	if (ship[0].ownerID == req.user.sub.substring(6)) {
	    deleteShip(req.params.shipID).then(() => {
		res.status(204).send('No Content');
	    });
	}
	else {
	    res.status(403).send("Permission to delete this ship not granted");
	}
    });
});

/*---------------END Ship Routing Functions---------------*/

/*---------------START User Routing Functions---------------*/

//Get a verified user's info
userRouter.get('/userID', checkJwt, function (req, res) {
    const userIDObj = {"id": req.user.sub.substring(6),
		       "name": req.user.nickname};
    res.status(200).send(userIDObj);
});

//Get the ships that belong to the verfied user, given their id is in the url
userRouter.get('/:userID/ships', checkJwt, function (req, res) {
    const accepted = req.get('Accept');
    if (req.params.userID == req.user.sub.substring(6)) {
	getUsersShips(req.params.userID).then(ships => {
	    if (ships.length == 0) {
		res.status(404).send('No ships found');
	    }
	    else if (accepted !== 'application/json' && accepted !== 'text/html') {
		res.status(406).send('No form acceptable');
	    }
	    else if (accepted === 'application/json') {
		res.status(200).json(ships);
	    }
	    else if (accepted === 'text/html') {
		res.status(200).send(json2html(ships).slice(1,-1));
	    }
	    else {
		res.status(500).send('Something went really wrong.');
	    }
	});
    }
    else {
	res.status(403).send("Permission to view these ships not granted");
    }
});

/*---------------END User Routing Functions---------------*/

/*---------------START Login Routing Functions---------------*/

//Login a user to get an id token
loginRouter.post('/', function (req, res) {
    const username = req.body.username;
    const password = req.body.password;
    var options = {
	method: 'POST',
	url: 'https://pappasc.auth0.com/oauth/token',
	headers: {
	    'content-type': 'application/json'
	},
	body: {
	    grant_type: 'password',
	    username: username,
	    password: password,
	    client_id: clientID,
	    client_secret: clientSecret
	},
	json: true
    };
    rp(options)
	.then(function (body) {
	    res.status(200).send(body);
	})
	.catch(function (err) {
	    res.status(500).send('Something broke getting the profile.');
	});
});

/*---------------END Login Routing Functions---------------*/

/*---------------START Signup Routing Functions---------------*/

//Signup a new user
signupRouter.post('/', function (req, res) {
    const email = req.body.email;
    const password = req.body.password;
    var options = {
	method: 'POST',
	url: 'https://pappasc.auth0.com/dbconnections/signup',
	headers: {
	    'content-type': 'application/json'
	},
	body: {
	    email: email,
	    password: password,
	    client_id: clientID,
	    connection: 'CS493SecureShips'
	},
	json: true
    };
    rp(options)
	.then(function (body) {
	    res.status(200).send(body);
	})
	.catch(function (err) {
	    res.status(500).send('Something broke making the profile.');
	});
});

/*---------------END Signup Routing Functions---------------*/

app.use('/ships', shipRouter);
app.use('/login', loginRouter);
app.use('/users', userRouter);
app.use('/signup', signupRouter);

const PORT = process.env.PORT || 8080;
app.listen(process.env.PORT || 8080, () => {
  console.log(`App listening on port ${PORT}`);
  console.log('Press Ctrl+C to quit.');
});

module.exports = app;

