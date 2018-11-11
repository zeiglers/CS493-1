/**************************************************************************************
Author: Conner Pappas, OSUID: 931835643
Class: CS493 - Cloud Application Development
Assignment: Intermediate API
Description: Create a restful API that we can run tests against
**************************************************************************************/
'use strict';

const express = require('express');
var shipRouter = express.Router();
var cargoRouter = express.Router();
const app = express();
const Datastore = require('@google-cloud/datastore');
const bodyParser = require('body-parser');

const projectID = 'CPCS493IntermediateAPI';
const ships = "SHIPS";
const cargo = "CARGO";
const shipCargo = "SHIPCARGO";
const pageSize = 3;

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
Method: postCargo
Parameters: weight - weight of the new cargo
            content - content of the new cargo
            deliverDate - delivery date of the cargo
Description: Create new cargo from a post request and save it to the datastore
**************************************************************************************/
function postCargo (weight, content, deliverDate) {
    var key = datastore.key(cargo);
    const newCargo = {
	"weight": weight,
	"content": content,
	"delivery_date": deliverDate
    };
    const newerCargo = {
	key: key,
	data: newCargo
    };
    return datastore.insert(newerCargo).then(() => {return key});
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
	"self": "https://cpcs493intermediateapi.appspot.com/ships/" + shippy[Datastore.KEY].id
    };
    return ship;
}

/**************************************************************************************
Method: shipCargoAssign
Parameters: shippy - a ship that was received from the datastore that we need to add
                     its cargo to before sending it to the client
Description: Add the cargo of a ship to its properties
**************************************************************************************/
function shipCargoAssign (shippy) {
    let cargoShipQuery = datastore.createQuery(shipCargo).filter('shipID', '=', shippy,id);
    
    return datastore.runQuery(cargoShipQuery).then(results => {
	if (typeof results[0] != undefined || results[0].length != 0) {
	    var cargoOnShip = [];
	    var i;
	    for (i = 0; i < results[0].length; i++) {
		var cargoItem = {
		    "id": results[0][i].id,
		    "self": "https://cpcs493intermediateapi.appspot.com/cargo/" + results[0][i].id
		};
		cargoOnShip.push(cargoItem);
	    }
	    if (cargoOnShip.length == 0) {
		cargoOnShip = null;
	    }
	    shippy.cargo = cargoOnShip;
	}
	return shippy;
    });
}

/**************************************************************************************
Method: getShips
Parameters: none
Description: Request the ships from the datastore
**************************************************************************************/
function getShips (req) {
    let shipQuery = datastore.createQuery(ships).limit(pageSize);

    if (req.query.cursor) {
	shipQuery = shipQuery.start(req.query.cursor);
    }
    
    return datastore.runQuery(shipQuery).then(results => {
	const returnData = {};
	const info = results[1];
	var resultingShips = results[0].map(shipIdAssign);
	
	let cargoShipQuery = datastore.createQuery(shipCargo);
	//literal garbage here
	//wrote an inner join so I could get the id's of ships and associated cargo to align
	return datastore.runQuery(cargoShipQuery).then(results => {
	    if (typeof results[0] != undefined || results[0].length != 0) {
		var i, j;
		for (i = 0; i < resultingShips.length; i++) {
		    var cargoOnShip = [];
		    for (j = 0; j < results[0].length; j++) {
			if (results[0][j].shipID == resultingShips[i].id) {
			    var cargoItem = {
				"id": results[0][j].cargoID,
				"self": "https://cpcs493intermediateapi.appspot.com/cargo/" + results[0][j].cargoID
			    };
			    cargoOnShip.push(cargoItem);
			}
		    }
		    if (cargoOnShip.length == 0) {
			cargoOnShip = null;
		    }
		    resultingShips[i].cargo = cargoOnShip;
		}
	    }
	    returnData.items = resultingShips;
	    if (info.moreResults !== Datastore.NO_MORE_RESULTS) {
		returnData.next = req.protocol + "://" + req.get("host") + req.baseUrl + "?cursor" + "=" + info.endCursor;
	    }
	    return returnData;
	});
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
	let cargoShipQuery = datastore.createQuery(shipCargo).filter('shipID', '=', shipID);
	//Same garbage as above, just less of it
	return datastore.runQuery(cargoShipQuery).then(results => {
	    if (typeof results[0] != undefined || results[0].length != 0) {
		var j;
		var cargoOnShip = [];
		for (j = 0; j < results[0].length; j++) {
		    var cargoItem = {
			"id": results[0][j].cargoID,
			"self": "https://cpcs493intermediateapi.appspot.com/cargo/" + results[0][j].cargoID
		    };
		    cargoOnShip.push(cargoItem);
		}
		if (cargoOnShip.length == 0) {
		    cargoOnShip = null;
		}
		resultingShip[0].cargo = cargoOnShip;
	    }
	    return resultingShip;
	});
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
Method: putCargoOnShip
Parameters: shipID - ID of the ship to add cargo to
            cargoID - ID of the cargo to add to the ship
Description: Load a ship with some cargo
**************************************************************************************/
function putCargoOnShip(shipID, cargoID) {
    const shipCargoQuery = datastore.createQuery(shipCargo).filter('cargoID', '=', cargoID);
    //Actually checking to make sure the ship and cargo both exist before making an entry
    //in the relationship table
    return datastore.runQuery(shipCargoQuery).then(results => {
	if (!Array.isArray(results[0]) || !results[0].length) {
	    const cargoQuery = datastore.createQuery(cargo);
	    return datastore.runQuery(cargoQuery).then(cargoResults => {
		const resultingCargo = cargoResults[0].map(cargoIdAssign);
		var isCargo = false;
		var i;
		for (i = 0; i < resultingCargo.length; i++) {
		    if (cargoID == resultingCargo[i].id) {
			isCargo = true;
			break;
		    }
		}
		if (isCargo) {
		    const shipQuery = datastore.createQuery(ships);
		    return datastore.runQuery(shipQuery).then(shipResults => {
			const resultingShips = shipResults[0].map(shipIdAssign);
			var isShip = false;
			var i;
			for (i = 0; i < resultingShips.length; i++) {
			    if (shipID == resultingShips[i].id) {
				isShip = true;
				break;
			    }
			}
			if (isShip) {
			    var key = datastore.key(shipCargo);
	    
			    const shipCargoPairData = {
				"shipID": shipID,
				"cargoID": cargoID
			    };
	    
			    const shipCargoPair = {
				key: key,
				data: shipCargoPairData
			    };
			    return datastore.insert(shipCargoPair).then(() => {return true});
			}
			else {
			    return false;
			}
		    });
		}
		else {
		    return false;
		}
		
	    });
	}
	else {
	    return false;
	}
    });
}

/**************************************************************************************
Method: unloadCargo
Parameters: shipID - ID of the ship to remove cargo from
            cargoID - ID of the cargo to remove from the ship
Description: Unload specific cargo from ship
**************************************************************************************/
function unloadCargo (shipID, cargoID) {
    const shipCargoQuery = datastore.createQuery(shipCargo).filter('cargoID', '=', cargoID).filter('shipID', '=', shipID);

    return datastore.runQuery(shipCargoQuery).then(results => {
	if (!Array.isArray(results[0]) || !results[0].length) {
	    return;
	}
	else {
	    const key = datastore.key([shipCargo, parseInt(results[0][0][Datastore.KEY].id,10)]);
	    
	    return datastore.delete(key).then(() => {return});
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

	let cargoShipQuery = datastore.createQuery(shipCargo).filter('shipID', '=', shipID);
    
	return datastore.runQuery(cargoShipQuery).then(results => {
	    var pairKeys = [];
	    var i;
	    for (i = 0; i < results[0].length; i++) {
		pairKeys.push(datastore.key([shipCargo, parseInt(results[0][i][Datastore.KEY].id,10)]));
	    }
	    return datastore.delete(pairKeys).then(() => {
		return;
	    });
	});	
    });
}

/**************************************************************************************
Method: cargoIdAssign
Parameters: cargy - The cargp received from the datastore to add an ID to
Description: Add the ID property to the cargo object before sending it to the client
**************************************************************************************/
function cargoIdAssign (cargy) {
    var cargyo = {
	"weight": cargy.weight,
	"content": cargy.content,
	"delivery_date": cargy.delivery_date,
	"id": cargy[Datastore.KEY].id,
	"self": "https://cpcs493intermediateapi.appspot.com/cargo/" + cargy[Datastore.KEY].id
    };
    return cargyo;
}

/**************************************************************************************
Method: getCargo
Parameters: none
Description: Get the cargo from the datastore
**************************************************************************************/
function getCargo (req) {
    let cargoQuery = datastore.createQuery(cargo).limit(pageSize);

    if (req.query.cursor) {
	cargoQuery = cargoQuery.start(req.query.cursor);
    }
    
    return datastore.runQuery(cargoQuery).then(results => {
	const returnData = {};
	var carrier = null;
	const info = results[1];
	var resultingCargo = results[0].map(cargoIdAssign);
	
	//include something here for getting ship pair
	let cargoShipQuery = datastore.createQuery(shipCargo);

	//this is literally a mess, because we're required to return the name of the ship
	//I'm literally writing an inner join by scratch here
	//Get the ship-cargo relationship table
	//Make sure it's not empty
	//Get all of the ships
	//Match cargo ids with the relationship table, then match ship ids to get the ship's name
	return datastore.runQuery(cargoShipQuery).then(cargoShipResults => {
	    if (typeof cargoShipResults[0] != undefined || cargoShipResults[0].length != 0) {
		let shipQuery = datastore.createQuery(ships);
		return datastore.runQuery(shipQuery).then(shipResults => {
		    const idShips = shipResults[0].map(shipIdAssign);
		    var i, j, k;
		    for (i = 0; i < resultingCargo.length; i++) {
			resultingCargo[i].carrier=carrier;
			for (j = 0; j < cargoShipResults[0].length; j++) {
			    if (cargoShipResults[0][j].cargoID == resultingCargo[i].id) {
				for (k = 0; k < idShips.length; k++) {
				    if (idShips[k].id == cargoShipResults[0][j].shipID) {
					carrier = {
					    "id": cargoShipResults[0][j].shipID,
					    "name": idShips[k].name,
					    "self": "https://cpcs493intermediateapi.appspot.com/ships/" + cargoShipResults[0][j].shipID
					};
					resultingCargo[i].carrier = carrier;
					carrier = null;
					break;
				    }
				}
			    }
			}
		    }
		    returnData.items = resultingCargo;
		    if (info.moreResults !== Datastore.NO_MORE_RESULTS) {
			returnData.next = req.protocol + "://" + req.get("host") + req.baseUrl + "?cursor" + "=" + info.endCursor;
		    }
		    return returnData;
		    
		});
	    }
	    else {
		returnData.items = resultingCargo;
		if (info.moreResults !== Datastore.NO_MORE_RESULTS) {
		    returnData.next = req.protocol + "://" + req.get("host") + req.baseUrl + "?cursor" + "=" + info.endCursor;
		}
		return returnData;
	    }
	});
    });
}

/**************************************************************************************
Method: getOneCargo
Parameters: cargoID - ID of the specific cargo requested
Description: Get a specific cargo item from the datastore
**************************************************************************************/
function getOneCargo (cargoID) {
    const key = datastore.key([cargo, parseInt(cargoID,10)]);
    const cargoQuery = datastore.createQuery(cargo).filter('__key__', '=', key);
    var carrier = null;
    return datastore.runQuery(cargoQuery).then(results => {
	var resultingCargo= results[0].map(cargoIdAssign);
	resultingCargo[0].carrier = carrier;
	let cargoShipQuery = datastore.createQuery(shipCargo);
	
	return datastore.runQuery(cargoShipQuery).then(cargoShipResults => {
	    if (typeof cargoShipResults[0] != undefined || cargoShipResults[0].length != 0) {
		let shipQuery = datastore.createQuery(ships);
		return datastore.runQuery(shipQuery).then(shipResults => {
		    const idShips = shipResults[0].map(shipIdAssign);
		    var j, k;
		    for (j = 0; j < cargoShipResults[0].length; j++) {
			if (cargoShipResults[0][j].cargoID == resultingCargo[0].id) {
			    for (k = 0; k < idShips.length; k++) {
				if (idShips[k].id == cargoShipResults[0][j].shipID) {
				    var carrier = {
					"id": cargoShipResults[0][j].shipID,
					"name": idShips[k].name,
					"self": "https://cpcs493intermediateapi.appspot.com/ships/" + cargoShipResults[0][j].shipID
				    };
				    resultingCargo[0].carrier = carrier;
				    carrier = null;
				    break;
				}
			    }
			}
		    }
		    

		    return resultingCargo;
		    
		});
	    }
	    else {
		//I don't even know if we get here, this is -just in case-
		return resultingCargo;
	    }
	});
    });
}

/**************************************************************************************
Method: getShipCargo
Parameters: shipID - id of the ship we are getting cargo of
            req - request parameter to see if there's a cursor
Description: Get a list of a ships cargo
**************************************************************************************/
function getShipCargo (shipID, req) {
    let cargoShipQuery = datastore.createQuery(shipCargo).limit(pageSize).filter('shipID', '=', shipID);

    if (req.query.cursor) {
	cargoShipQuery = cargoShipQuery.start(req.query.cursor);
    }
    
    return datastore.runQuery(cargoShipQuery).then(results => {
	var cargoKeys = [];
	var i;
	const info = results[1];
	for (i = 0; i < results[0].length; i++) {
	    cargoKeys.push(datastore.key([cargo, parseInt(results[0][i].cargoID,10)]));
	}
	return datastore.get(cargoKeys).then(resultingCargo => {
	    const returnData = {};
	    var resultingCargoAssigned = resultingCargo[0].map(cargoIdAssign);
	    return getShip(shipID).then(theShip => {
		var i;
		for (i = 0; i < resultingCargoAssigned.length; i++) {
		    resultingCargoAssigned[i].carrier = {
			"id": theShip[0].id,
			"name": theShip[0].name,
			"self": "https://cpcs493intermediateapi.appspot.com/ships/" + theShip[0].id
		    };
		}
		returnData.items = resultingCargoAssigned;
		if (info.moreResults !== Datastore.NO_MORE_RESULTS) {
		    returnData.next = req.protocol + "://" + req.get("host") + req.baseUrl + "/" + shipID + "/cargo" + "?cursor" + "=" + info.endCursor;
		}
		return returnData;
	    });
	    
	});
    });
}

/**************************************************************************************
Method: modifyCargo
Parameters: cargoID - ID of the cargo wished to modify
            newData - The data wished to change in the cargo
Description: Modify a specific cargo to have different data. Does not allow assigning
             of a ship
**************************************************************************************/
function modifyCargo (cargoID, newData) {
    const key = datastore.key([cargo, parseInt(cargoID,10)]);
    return datastore.get(key).then(results => {
	var updatedCargo = {
	    "weight": results[0].weight,
	    "content": results[0].content,
	    "delivery_date": results[0].delivery_date
	};
	
	if (newData.weight != null) {
	    updatedCargo.weight = newData.weight;
	}
	if (newData.content != null) {
	    updatedCargo.content = newData.content;
	}
	if (newData.delivery_date != null) {
	    updatedCargo.delivery_date = newData.delivery_date;
	}
	
	const fullyUpdatedCargo = {
	    key: key,
	    data: updatedCargo
	};

	return datastore.update(fullyUpdatedCargo).then(() => {
	    return getOneCargo(cargoID);
	});
    });
}

/**************************************************************************************
Method: deleteCargo
Parameters: cargoID - ID of the cargo to delete
Description: Delete the specified cargo from the datastore
**************************************************************************************/
function deleteCargo(cargoID) {
    const key = datastore.key([cargo, parseInt(cargoID,10)]);
    return datastore.delete(key).then(() => {
	let cargoShipQuery = datastore.createQuery(shipCargo).filter('cargoID', '=', cargoID);
    
	return datastore.runQuery(cargoShipQuery).then(results => {
	    if (results[0].length > 0) {
		const pairKey = datastore.key([shipCargo, parseInt(results[0][0][Datastore.KEY].id,10)]);
		return datastore.delete(pairKey).then(() => {
		    return;
		});
	    }
	    else {
		return;
	    }
	});
    });
}

/********************END OF HELPER FUNCTIONS*******************************/

app.get('/', function (req, res) {
  //display a homepage or return links to get ships or slips
});

/*---------------START Ship Routing Functions---------------*/
// Get all ships
shipRouter.get('/', function (req, res) {
    const ships = getShips(req).then((ships) => {
	res.status(200).json(ships);
    });
});

// Get specific ship
shipRouter.get('/:shipID', function (req, res) {
    const ship = getShip(req.params.shipID).then((ship) => {
	res.status(200).json(ship);
    });
});

// Get a ship's cargo
shipRouter.get('/:shipID/cargo', function (req, res) {
    getShipCargo(req.params.shipID, req).then((cargo) => {
	res.status(200).json(cargo);
    });
}); 

// Create a new ship
shipRouter.post('/', function (req, res) {
    postShip(req.body.name, req.body.type, req.body.length).then((key) => {
	res.status(200).send('{"id": ' + key.id + '}')});
});

// Modify a ship
shipRouter.patch('/:shipID', function (req, res) {
    const ship = modifyShip(req.params.shipID, req.body).then((ship) => {
	res.status(200).json(ship);
    });
});

// Put cargo on a ship
shipRouter.put('/:shipID/cargo/:cargoID', function (req, res) {
    putCargoOnShip(req.params.shipID, req.params.cargoID).then((loaded) => {
	if (loaded) {
	    getShip(req.params.shipID).then((ship) => {
		res.status(200).json(ship);
	    });
	}
	else {
	    res.status(403).send();
	}
    });
});

// Remove cargo from a ship
shipRouter.delete('/:shipID/cargo/:cargoID', function (req, res) {
    unloadCargo(req.params.shipID, req.params.cargoID).then(() => {
	res.status(200).send();
    });
});

// Delete a ship
shipRouter.delete('/:shipID', function (req, res) {
    deleteShip(req.params.shipID).then(() => {
	res.status(200).send();
    });
});

/*---------------END Ship Routing Functions---------------*/

/*---------------START Cargo Routing Functions---------------*/
// Get the cargo
cargoRouter.get('/', function (req, res) {
    const gotCargo = getCargo(req).then((gotCargo) => {
	res.status(200).json(gotCargo);
    });
});

// Get a specific cargo
cargoRouter.get('/:cargoID', function (req, res) {
    const gotOneCargo = getOneCargo(req.params.cargoID).then((gotOneCargo) => {
	res.status(200).json(gotOneCargo);
    });
});

// Create a new cargo
cargoRouter.post('/', function (req, res) {
    postCargo(req.body.weight, req.body.content, req.body.delivery_date).then((key) => {
	res.status(200).send('{"id": ' + key.id + '}')});
});

// Delete a cargo
cargoRouter.delete('/:cargoID', function (req, res) {
    deleteCargo(req.params.cargoID).then(() => {
	res.status(200).send();
    });
});

// Modify a cargo
cargoRouter.patch('/:cargoID', function (req, res) {
    const oneCargo = modifyCargo(req.params.cargoID, req.body).then((oneCargo) => {
	res.status(200).json(oneCargo);
    });
});

/*---------------END Cargo Routing Functions---------------*/

app.use('/ships', shipRouter);
app.use('/cargo', cargoRouter);

const PORT = process.env.PORT || 8080;
app.listen(process.env.PORT || 8080, () => {
  console.log(`App listening on port ${PORT}`);
  console.log('Press Ctrl+C to quit.');
});

module.exports = app;

