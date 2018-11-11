/**************************************************************************************
Author: Conner Pappas, OSUID: 931835643
Class: CS493 - Cloud Application Development
Assignment: Build a Restful API
Description: Create a restful API that we can run tests against
**************************************************************************************/
'use strict';

const express = require('express');
var shipRouter = express.Router();
var slipRouter = express.Router();
const app = express();
const Datastore = require('@google-cloud/datastore');
const bodyParser = require('body-parser');

const projectID = 'restful-api-ships';
const ships = "SHIPS";
const slips = "SLIPS";

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

    return datastore.insert(newShip).then(() => {return key});
}

/**************************************************************************************
Method: postSlip
Parameters: number - number of the new slip
Description: Create a new slip from a post request and save it to the datastore
**************************************************************************************/
function postSlip (number) {
    var key = datastore.key(slips);
    const slip = {
	"number": number,
	"current_boat": null,
	"arrival_date": ""
    };
    const newSlip = {
	key: key,
	data: slip
    };

    return datastore.insert(newSlip).then(() => {return key});
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
	"id": shippy[Datastore.KEY].id
    };
    return ship;
}

/**************************************************************************************
Method: getShips
Parameters: none
Description: Request the ships from the datastore
**************************************************************************************/
function getShips () {
    const shipQuery = datastore.createQuery(ships);
    return datastore.runQuery(shipQuery).then(results => {
	const resultingShips = results[0].map(shipIdAssign);
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
	const resultingShip = results[0].map(shipIdAssign);
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
	    return getShip(shipID);
	});
    });
}

/**************************************************************************************
Method: shipDeparture
Parameters: shipID - The ID of the ship we want to make depart
            slipID - The ID of the slip the ship is parked in
Description: Make a ship depart from its slip
**************************************************************************************/
function shipDeparture(shipID, slipID) {
    return getSlip(slipID).then((slip) => {
	if (slip[0].current_boat != shipID) {
	    return false;
	}
	else {
	    const slipWithoutShip = {
		"number": slips[0].number,
		"current_boat": null,
		"arrival_date": ""
	    };
	    return modifySlip(slipID, slipWithoutShip).then(() => {return true});
	}
    });
}

/**************************************************************************************
Method: deleteShip
Parameters: shipID - ID of the ship to delete
Description: Delete a ship from the datastore
**************************************************************************************/
function deleteShip (shipID) {
    const key = datastore.key([ships, parseInt(shipID,10)]);
    return datastore.delete(key).then(() => {
	return getSlips().then((slips) => {
	    var i;
	    for (i = 0; i < slips.length; i++) {
		if (slips[i].current_boat == shipID) {
		    const slipWithoutShip = {
			"number": slips[i].number,
			"current_boat": null,
			"arrival_date": ""
		    };
		    return modifySlip(slips[i].id, slipWithoutShip).then(() => {});
		}
	    }
	});
    });
}

/**************************************************************************************
Method: slipIdAssign
Parameters: slippy - The slip received from the datastore to add an ID to
Description: Add the ID property to the slip object before sending it to the client
**************************************************************************************/
function slipIdAssign (slippy) {
    var slip = {
	"number": slippy.number,
	"current_boat": slippy.current_boat,
	"arrival_date": slippy.arrival_date,
	"id": slippy[Datastore.KEY].id
    };
    return slip;
}

/**************************************************************************************
Method: getSlips
Parameters: none
Description: Get the slips from the datastore
**************************************************************************************/
function getSlips () {
    const slipQuery = datastore.createQuery(slips);
    return datastore.runQuery(slipQuery).then(results => {
	var resultingSlips = results[0].map(slipIdAssign);
	var i;
	for (i = 0; i < resultingSlips.length; i++) {
	    if (resultingSlips[i].current_boat != null) {
		resultingSlips[i].ship_url = "https://restful-api-ships.appspot.com/ships/" + resultingSlips[i].current_boat;
	    }
	}
	return resultingSlips;
    });
}

/**************************************************************************************
Method: getSlip
Parameters: slipID - ID of the specific slip requested
Description: Get a specific slip from the datastore
**************************************************************************************/
function getSlip (slipID) {
    const key = datastore.key([slips, parseInt(slipID,10)]);
    const slipQuery = datastore.createQuery(slips).filter('__key__', '=', key);
    return datastore.runQuery(slipQuery).then(results => {
	var resultingSlip = results[0].map(slipIdAssign);
	if (resultingSlip[0].current_boat != null) {
	    resultingSlip[0].ship_url = "https://restful-api-ships.appspot.com/ships/" + resultingSlip[0].current_boat;
	}
	return resultingSlip;
    });
}

/**************************************************************************************
Method: modifySlip
Parameters: slipID - ID of the slip wished to modify
            newData - The data wished to change in the slip
Description: Modify a specific slip to have different data. Does not allow assigning
             of a ship
**************************************************************************************/
function modifySlip (slipID, newData) {
    const key = datastore.key([slips, parseInt(slipID,10)]);
    return datastore.get(key).then(results => {
	var updatedSlip = {
	    "number": results[0].number,
	    "current_boat": results[0].current_boat,
	    "arrival_date": results[0].arrival_date
	};
	
	if (newData.number != null) {
	    updatedSlip.number = newData.number;
	}
	if (newData.current_boat == null) {
	    updatedSlip.current_boat = null;
	    updatedSlip.arrival_date = "";
	}
	if (newData.arrival_date != null) {
	    updatedSlip.arrival_date = newData.arrival_date;
	}
	
	const fullyUpdatedSlip = {
	    key: key,
	    data: updatedSlip
	};

	return datastore.update(fullyUpdatedSlip).then(() => {
	    return getSlip(slipID);
	});
    });
}

/**************************************************************************************
Method: shipArrivalModify
Parameters: slipID - ID of the slip to be docked in
            shipID - ID of the ship to dock
            arriveDate - Date of arrival of the ship
Description: Special modify function for slips to allow ships to be docked in them
**************************************************************************************/
function shipArrivalModify (slipID, shipID, arriveDate) {
    const key = datastore.key([slips, parseInt(slipID,10)]);
    return datastore.get(key).then(results => {
	var updatedSlip = {
	    "number": results[0].number,
	    "current_boat": shipID,
	    "arrival_date": arriveDate
	};
	
	const fullyUpdatedSlip = {
	    key: key,
	    data: updatedSlip
	};

	return datastore.update(fullyUpdatedSlip).then(() => {
	    return getSlip(slipID);
	});
    });
}

/**************************************************************************************
Method: deleteSlip
Parameters: slipID - ID of the slip to delete
Description: Delete the specified slip from the datastore
**************************************************************************************/
function deleteSlip(slipID) {
    const key = datastore.key([slips, parseInt(slipID,10)]);
    return datastore.delete(key).then(() => {});
}

/**************************************************************************************
Method: shipArrival
Parameters: sipParams - contains slip ID to dock a ship with ship ID
Description: Dock a ship in a slip if it's empty and modify the slip
**************************************************************************************/
function shipArrival (sipParams) {
    return getSlip(sipParams.slipID).then((slipToCheck) => {
	if (slipToCheck[0].current_boat != null) {
	    return false;
	}
	else {
	    return getSlips().then((currentSlips) => {
		var i;
		for (i = 0; i < currentSlips.length; i++) {
		    if (currentSlips[i].current_boat == sipParams.shipID) {
			return shipDeparture(sipParams.shipID, currentSlips[i].id).then(() => {return true;});
		    }
		}
		return true;
	    }); 
	}
    });
}

/********************END OF HELPER FUNCTIONS*******************************/

app.get('/', function (req, res) {
  //display a homepage or return links to get ships or slips
});

/*---------------START Ship Routing Functions---------------*/
// Get all ships
shipRouter.get('/', function (req, res) {
    const ships = getShips().then((ships) => {
	res.status(200).json(ships);
    });
});

// Get specific ship
shipRouter.get('/:shipID', function (req, res) {
    const ship = getShip(req.params.shipID).then((ship) => {
	res.status(200).json(ship);
    });
});

// Create a new ship
shipRouter.post('/', function (req, res) {
    postShip(req.body.name, req.body.type, req.body.length).then((key) => {
	res.status(200).send('{"id": ' + key.id + '}')});
});

// Make a ship depart from its slip
shipRouter.put('/:shipID/slips/:slipID', function (req, res) {
    shipDeparture(req.params.shipID, req.params.slipID).then((departing) => {
	if (departing) {
	    res.status(200).send();
	}
	else {
	    res.status(403).send();
	}
    });
});

// Modify a ship
shipRouter.patch('/:shipID', function (req, res) {
    const ship = modifyShip(req.params.shipID, req.body).then((ship) => {
	res.status(200).json(ship);
    });
});

// Delete a ship
shipRouter.delete('/:shipID', function (req, res) {
    deleteShip(req.params.shipID).then(() => {
	res.status(200).send();
    });
});

/*---------------END Ship Routing Functions---------------*/

/*---------------START Slip Routing Functions---------------*/
// Get the slips
slipRouter.get('/', function (req, res) {
    const slips = getSlips().then((slips) => {
	res.status(200).json(slips);
    });
});

// Get a specific slip
slipRouter.get('/:slipID', function (req, res) {
    const slip = getSlip(req.params.slipID).then((slip) => {
	res.status(200).json(slip);
    });
});

// Create a new slip
slipRouter.post('/', function (req, res) {
    postSlip(req.body.number).then((key) => {
	res.status(200).send('{"id": ' + key.id + '}')});
});

// Delete a slip
slipRouter.delete('/:slipID', function (req, res) {
    deleteSlip(req.params.slipID).then(() => {
	res.status(200).send();
    });
});

// Modify a slip
slipRouter.patch('/:slipID', function (req, res) {
    const slip = modifySlip(req.params.slipID, req.body).then((slip) => {
	res.status(200).json(slip);
    });
});

// Park a ship in a slip
slipRouter.put('/:slipID/ships/:shipID', function (req, res) {
    shipArrival(req.params).then((arriving) => {
	if (arriving) {
	    const slip = shipArrivalModify (req.params.slipID, req.params.shipID, req.body.arrival_date).then((slip) => {
		res.status(200).json(slip);});
	}
	else {
	    res.status(403).send();
	}
    });
});

/*---------------END Slip Routing Functions---------------*/

app.use('/ships', shipRouter);
app.use('/slips', slipRouter);

const PORT = process.env.PORT || 8080;
app.listen(process.env.PORT || 8080, () => {
  console.log(`App listening on port ${PORT}`);
  console.log('Press Ctrl+C to quit.');
});

module.exports = app;

