const { ethers } = require("hardhat");
const {
  Component,
  VehicleProperties,
  Transaction,
  Vehicle,
  createVehicleFromJSON,
} = require("./utils/Vehicle.js");


const component1 = new Component("Engine", 123456, [
  "2023-06-01",
  "2023-06-15",
  "2023-06-30",
]);
const component2 = new Component("Tires", 789012, ["2023-06-10", "2023-06-25"]);
const vehicleProps = new VehicleProperties(
  10000,
  5,
  5000,
  987654,
  "Tesla Model S",
  "John Doe"
);
const transaction1 = new Transaction("Alice", "Bob", "2023-06-01", 1000);
const transaction2 = new Transaction("Eve", "Charlie", "2023-06-05", 2000);

const exVehicle = new Vehicle();

exVehicle.components.push(component1);
exVehicle.components.push(component2);
exVehicle.details = vehicleProps;
exVehicle.transactions.push(transaction1);
exVehicle.transactions.push(transaction2);

module.exports = async () => {
  const wallet = (await ethers.getSigners())[0];
  const vehicleTracker = await ethers.getContractAt(
    "VehicleTracker",
    process.env.CONTRACT_ADDRESS,
    wallet
  );

  try {
    const ipfsHash = await uploadVehicleToIpfs(exVehicle);

    console.log(`IPFS Hash of minted NFT: ipfs://${ipfsHash.hash}`);

    const res = await vehicleTracker.safeMint(
      "0xde7fc4f204676255c1cec21f0dd59792227dca97",
      "ipfs://" + ipfsHash.hash
    );

    let v = await readVehicleFromUri(ipfsHash.hash);

    console.log("Here the intial vehicle: \n" + JSON.stringify(v));

    let updatedTokenURI = await addComponents(new Component("Clutch", 8000, ["ieri", "oggi", "19-19-19"]), vehicleTracker, 1);
    v = await readVehicleFromUri(updatedTokenURI);

    console.log("Here the vehicle after adding a new component: \n" + JSON.stringify(v));

    updatedTokenURI = await addTransactions(new Transaction("Mattia", "Gianluca", "01/01/1970", "12500"), vehicleTracker, 1);
    v = await readVehicleFromUri(updatedTokenURI);

    console.log("Here the vehicle after adding a new transaction: \n" + JSON.stringify(v));

    updatedTokenURI = await changeCarDetails(new VehicleProperties(1201221, 80, 15000, "GA000AA", "Ferrari F40", "Mattia"), vehicleTracker, 1);
    v = await readVehicleFromUri(updatedTokenURI);
    
    console.log("Here the vehicle after changing its details: \n" + JSON.stringify(v));

  } catch (error) {
    console.log(error);
  }
};

async function uploadVehicleToIpfs(vehicle) {
  const metadataFile = await new Promise((resolve, reject) => {
    ipfs.files.add(Buffer.from(JSON.stringify(vehicle)), (err, files) => {
      if (err) {
        reject(err);
      } else {
        resolve(files[0]);
      }
    });
  });

  const metadata = {
    description: "Description of a vehicle...",
    external_url: "https://google.com",
    image: `ipfs://${metadataFile.hash}`,
    name: "Vehicle...",
  };

  const metadataFileWithMetadata = await new Promise((resolve, reject) => {
    ipfs.files.add(Buffer.from(JSON.stringify(metadata)), (err, files) => {
      if (err) {
        reject(err);
      } else {
        resolve(files[0]);
      }
    });
  });
  return metadataFileWithMetadata;
}

async function readVehicleFromUri(metadatahash) {
  const data = await ipfs.files.cat(metadatahash.replace("ipfs://", ""));
  const metadata = JSON.parse(data.toString());
  const vehicleURI = metadata["image"].replace("ipfs://", "");
  const vehicleData = await ipfs.files.cat(vehicleURI);
  return createVehicleFromJSON(JSON.parse(vehicleData.toString()));
}

async function addComponents(components, contract, tokenID) {
  const vehicleHash = await contract.tokenURI(tokenID);

  let vehicle = await readVehicleFromUri(vehicleHash);

  components = Array.isArray(components) ? components : new Array(components);

  components.forEach((n) => {
    let exists = false;
    vehicle.components.forEach((old) => {
      if (old.serialNumber == n.serialNumber) {
        old.maintenanceDate.push(n);
        exists = true;
        return;
      }
    });
    if (!exists) vehicle.components.push(n);
    exists = false;
  });

  try {
    const updatedTokenURI = await uploadVehicleToIpfs(vehicle);
    await contract.setTokenURI(tokenID, updatedTokenURI.hash);
    console.log(`IPFS Hash of updated NFT: ipfs://${updatedTokenURI.hash}`);
    return updatedTokenURI.hash;
  } catch (e) {
    console.log(e);
  }
}

async function addTransactions(transactions, contract, tokenID) {
  const vehicleHash = await contract.tokenURI(tokenID);

  let vehicle = await readVehicleFromUri(vehicleHash);

  transactions = Array.isArray(transactions) ? transactions : new Array(transactions);

  transactions.forEach((n) => {
    vehicle.transactions.push(n);
  });

  try {
    const updatedTokenURI = await uploadVehicleToIpfs(vehicle);
    await contract.setTokenURI(tokenID, updatedTokenURI.hash);
    console.log(`IPFS Hash of updated NFT: ipfs://${updatedTokenURI.hash}`);
    return updatedTokenURI.hash;
  } catch (e) {
    console.log(e);
  }
}

async function changeCarDetails(details, contract, tokenID) {
  const vehicleHash = await contract.tokenURI(tokenID);
  let vehicle = await readVehicleFromUri(vehicleHash);

  vehicle.details.km = details.km;
  vehicle.details.damagescore = details.damagescore;
  vehicle.details.estprice = details.estprice;
  vehicle.details.currowner = details.currowner;

  try {
    const updatedTokenURI = await uploadVehicleToIpfs(vehicle);
    await contract.setTokenURI(tokenID, updatedTokenURI);
    console.log(`IPFS Hash of updated NFT: ipfs://${updatedTokenURI.hash}`);
    return updatedTokenURI.hash;
  } catch (e) {
    console.log(e);
  }
}