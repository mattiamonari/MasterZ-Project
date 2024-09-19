const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const path = require("path");
const { ethers } = require("hardhat");
const { createVehicleFromJSON } = require("./scripts/utils/Vehicle");
const {
  Component,
  VehicleProperties,
  Transaction,
  Vehicle,
} = require("./scripts/utils/Vehicle.js");
const IpfsAPI = require("ipfs-api");
const ipfs = IpfsAPI("127.0.0.1", "5001");

// Parse URL-encoded bodies and JSON bodies
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.post("/mint", async (req, res) => {
  const wallet = await ethers.getSigners()[0];
  const vehicleTracker = await ethers.getContractAt(
    "VehicleTracker",
    process.env.CONTRACT_ADDRESS,
    wallet
  );

  // Handle the form submission logic here
  //console.log(req.body);
  var comp = JSON.parse(req.body.components);
  var tran = JSON.parse(req.body.transactions);
  var prop = JSON.parse(req.body.properties);
  const vehicle = new Vehicle();
  var p = new VehicleProperties(
    prop.km,
    prop.damagescore,
    prop.estprice,
    prop.serialNumber,
    prop.model,
    prop.currowner
  );

  var c = new Component(
    comp.componentname,
    comp.serialNumber,
    comp.maintenanceDate
  );

  var t = new Transaction(tran.buyer, tran.seller, tran.date, tran.price);

  vehicle.components.push(c);
  vehicle.transactions.push(t);
  vehicle.details = p;

  const ipfsHash = await uploadVehicleToIpfs(vehicle); //Not ex vehicle. We must read it from the form

  console.log(`IPFS Hash of minted NFT: ipfs://${ipfsHash.hash}`);

  if (isValidEthereumAddress(req.body.recipientAddress)) {
    const result = await vehicleTracker.safeMint(
      req.body.recipientAddress,
      "ipfs://" + ipfsHash.hash
    );

    console.log(result);

    let v = await readVehicleFromUri(ipfsHash.hash);

    console.log("Here the intial vehicle: \n" + JSON.stringify(v));
    res.send(
      "Minted NFT, check the transaction hash: " +
        result.hash +
        "\n" +
        "Here's your tokenID: " +
        result.value
    );
    return;
  } else {
    res.send("Invalid address");
    return;
  }
});

app.post("/modify", async (req, res) => {
  const wallet = await ethers.getSigners()[0];
  const vehicleTracker = await ethers.getContractAt(
    "VehicleTracker",
    process.env.CONTRACT_ADDRESS,
    wallet
  );

  // Handle the form submission logic here
  if (req.body.components != "" || req.body.components != undefined) {
    var comp = JSON.parse(req.body.components);
    var c = new Component(
      comp.componentname,
      comp.serialNumber,
      comp.maintenanceDate
    );
    let updatedTokenURI = await addComponents(
      c,
      vehicleTracker,
      req.body.tokenID
    );
    readVehicleFromUri(updatedTokenURI).then((result) => console.log(result));
  }

  if (req.body.transactions != "" || req.body.transactions != undefined) {
    var tran = JSON.parse(req.body.transactions);
    var t = new Transaction(tran.buyer, tran.seller, tran.date, tran.price);
    let updatedTokenURI = await addTransactions(
      t,
      vehicleTracker,
      req.body.tokenID
    );
    readVehicleFromUri(updatedTokenURI).then((result) => console.log(result));
  }

  if (req.body.properties != "" || req.body.properties != undefined) {
    var prop = JSON.parse(req.body.properties);
    var p = new VehicleProperties(
      prop.km,
      prop.damagescore,
      prop.estprice,
      prop.serialNumber,
      prop.currowner
    );
    let updatedTokenURI = await changeCarDetails(
      p,
      vehicleTracker,
      req.body.tokenID
    );
    readVehicleFromUri(updatedTokenURI).then((result) => console.log(result));
  }
  res.send("Ok")
});

// Start the server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

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

  console.log(vehicleHash);

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

  transactions = Array.isArray(transactions)
    ? transactions
    : new Array(transactions);

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

function isValidEthereumAddress(address) {
  const addressRegex = /^(0x)?[0-9a-fA-F]{40}$/;
  return addressRegex.test(address);
}
