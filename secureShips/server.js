/**************************************************************************************
Author: Conner Pappas, OSUID: 931835643
Class: CS493 - Cloud Application Development
Assignment: Advanced API
Description: Create a restful API that we can run tests against, status codes improved
**************************************************************************************/
'use strict';

const express = require('express');
var shipRouter = express.Router();
const app = express();
const Datastore = require('@google-cloud/datastore');
const bodyParser = require('body-parser');
const json2html = require('json-to-html');
const ships = "SHIPS";
const projectID = 'CPCS493SecureShips';

const datastore = new  Datastore({projectID:projectID});
app.use(bodyParser.json());

/**************************************************************************************
Method: postShip
Parameters: name - name of the new ship
            type - type of the new ship
            length - length of the new ship
Description: Create a new ship from a post request and save it to the datastore
**************************************************************************************/
function postShip (name, type, length) {
    var key = datastore.key(ships);
    const ship = {
	"name": name,
	"type": type,
	"length": length
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
	"id": shippy[Datastore.KEY].id,
	"self": "https://cpcs493advancedapi.appspot.com/ships/" + shippy[Datastore.KEY].id
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
Method: getShip
Parameters: shipID - ID of the specific ship requested
Description: Get a specific ship from the datastore
**************************************************************************************/
function getShip (shipID) {
    const key = datastore.key([ships, parseInt(shipID,10)]);
    const shipQuery = datastore.createQuery(ships).filter('__key__', '=', key);
    return datastore.runQuery(shipQuery).then(results => {
	var resultingShip = results[0].map(shipIdAssign);
	return resultingShip;
    });
}

/**************************************************************************************
Method: modifyShip
Parameters: shipID - ID of the ship to modify
            newData - Data received from a client to change the ship
Description: Modify a specific ship
**************************************************************************************/
function modifyShip (shipID, newData) {
    const key = datastore.key([ships, parseInt(shipID,10)]);
    return datastore.get(key).then(results => {
	var updatedShip = {
	    "name": results[0].name,
	    "type": results[0].type,
	    "length": results[0].length,
	};
	
	if (newData.name != null) {
	    updatedShip.name = newData.name;
	}
	if (newData.type != null) {
	    updatedShip.type = newData.type;
	}
	if (newData.length != null) {
	    updatedShip.length = newData.length;
	}
	
	const fullyUpdatedShip = {
	    key: key,
	    data: updatedShip
	};

	return datastore.update(fullyUpdatedShip).then(() => {
	    return;
	});
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

app.get('/', function (req, res) {
  //display a homepage or return links to get ships or slips
});

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

// Get specific ship
shipRouter.get('/:shipID', function (req, res) {
    const accepted = req.get('Accept');
    getShip(req.params.shipID).then((ship) => {
	if (ship.length == 0) {
	    res.status(404).send('Ship with that ID not found');
	}
	else if (accepted !== 'application/json' && accepted !== 'text/html') {
	    res.status(406).send('No form acceptable');
	}
	else if (accepted === 'application/json') {
	    res.status(200).json(ship);
	}
	else if (accepted === 'text/html') {
	    res.status(200).send(json2html(ship).slice(1,-1));
	}
	else {
	    res.status(500).send('Something went really wrong.');
	}
	
    });
});

// Create a new ship
shipRouter.post('/', function (req, res) {
    if (req.get('content-type') !== 'application/json') {
	res.status(415).send('Server only accpets application/json data, you ding dong.');
    }
    else {
	postShip(req.body.name, req.body.type, req.body.length).then((key) => {
	    res.location(req.protocol + "://" + req.get('host') + req.baseUrl + '/' + key.id);
	    res.status(201).send('{"id": ' + key.id + '}')
	});
    }
});

// Patch route for ships without the specified ID
shipRouter.patch('/', function (req, res) {
    res.set('Accept', 'GET, POST');
    res.status(405).end();
});

// Delete route for ships without the specified ID
shipRouter.delete('/', function (req, res) {
    res.set('Accept', 'GET, POST');
    res.status(405).end();
});

// Modify a ship
shipRouter.patch('/:shipID', function (req, res) {
    if (req.get('content-type') !== 'application/json') {
	res.status(415).send('Server only accepts application/json data, you ding dong.');
    }
    else {
	getShip(req.params.shipID).then((ship) => {
	    if (ship.length == 0) {
		res.status(404).send('Ship with that ID not found');
	    }
	    else {
		modifyShip(req.params.shipID, req.body).then(() => {
		    res.location(req.protocol + "://" + req.get('host') + req.baseUrl + '/' + req.params.shipID);
		    res.status(303).send();
		});
	    }
	});
    }
});

// Delete a ship
shipRouter.delete('/:shipID', function (req, res) {
    deleteShip(req.params.shipID).then(() => {
	res.status(204).send('No Content');
    });
});

/*---------------END Ship Routing Functions---------------*/

app.use('/ships', shipRouter);

const PORT = process.env.PORT || 8080;
app.listen(process.env.PORT || 8080, () => {
  console.log(`App listening on port ${PORT}`);
  console.log('Press Ctrl+C to quit.');
});

module.exports = app;

