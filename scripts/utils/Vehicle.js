class Component {
  constructor(componentname, serialNumber, maintenanceDate) {
    this.componentname = componentname;
    this.serialNumber = serialNumber;
    this.maintenanceDate = maintenanceDate;
  }
}

class VehicleProperties {
  constructor(km, damagescore, estprice, serialNumber, model, currowner) {
    this.km = km;
    this.damagescore = damagescore;
    this.estprice = estprice;
    this.serialNumber = serialNumber;
    this.model = model;
    this.currowner = currowner;
  }
}

class Transaction {
  constructor(buyer, seller, date, price) {
    this.buyer = buyer;
    this.seller = seller;
    this.date = date;
    this.price = price;
  }
}

class Vehicle {
  constructor() {
    this.components = new Array();
    this.details = null;
    this.transactions = new Array();
  }
}

function createVehicleFromJSON(vehicleData) {
  const vehicle = new Vehicle();
  vehicle.details = new VehicleProperties(
    vehicleData.details.km,
    vehicleData.details.damagescore,
    vehicleData.details.estprice,
    vehicleData.details.serialNumber,
    vehicleData.details.model,
    vehicleData.details.currowner
  );

  // Assign the components
  for (const componentData of vehicleData.components) {
    const component = new Component(
      componentData.componentname,
      componentData.serialNumber,
      componentData.maintenanceDate
    );
    vehicle.components.push(component);
  }

  // Assign the transactions
  for (const transactionData of vehicleData.transactions) {
    const transaction = new Transaction(
      transactionData.buyer,
      transactionData.seller,
      transactionData.date,
      transactionData.price
    );
    vehicle.transactions.push(transaction);
  }

  return vehicle;
}

module.exports = {
  Component,
  VehicleProperties,
  Transaction,
  Vehicle,
  createVehicleFromJSON
};
