const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const dotenv = require("dotenv");
const jwt = require("jsonwebtoken");

dotenv.config();

const port = process.env.port || 5000;
const app = express();
app.use(express.json());
app.use(cors());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@ariyan.mefyr.mongodb.net/?retryWrites=true&w=majority&appName=Ariyan`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    const db = client.db("assignment-12");
    const usersCollection = db.collection("users");
    const assetCollection = db.collection("assets");
    const employeeCollection = db.collection("employees");
    const requestsCollection = db.collection("requests");

    const verifyToken = (req, res, next) => {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ message: "Unauthorized access" });
      }

      const token = authHeader.split(" ")[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).json({ message: "Unauthorized access" });
        }
        req.decoded = decoded;
        next();
      });
    };

    const verifyHrManager = async (req, res, next) => {
      const email = req.decoded.email;
      const user = await usersCollection.findOne({ email });
      if (user?.role !== "hr-manager") {
        return res.status(403).json({ message: "Forbidden access" });
      }
      next();
    };

    app.post("/jwt", async (req, res) => {
      try {
        const user = req.body;
        const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
          expiresIn: "24h",
        });
        res.json({ token });
      } catch (err) {
        res
          .status(500)
          .json({ message: "Failed to generate token", error: err.message });
      }
    });

    app.post("/users", async (req, res) => {
      const { hrInfo } = req.body;
      console.log("Received data:", hrInfo);
      const query = { email: hrInfo?.email };
      const existingUser = await usersCollection.findOne(query);
      if (existingUser) {
        return res.send({
          message: "User Already Exists In DB",
          insertedId: null,
        });
      }
      const result = await usersCollection.insertOne(hrInfo);
      res.send(result);
    });

    app.patch("/update-employee/:id", async (req, res) => {
      const id = req.params.id;
      const { company, companyImage, companyEmail } = req.body;

      try {
        // Update the user's fields in the users collection
        const updatedUser = await usersCollection.updateOne(
          { _id: new ObjectId(id) }, // Match the user by their ID
          {
            $set: {
              company, // Add or update company name
              companyImage, // Add or update company image
              companyEmail, // Add or update company email
            },
          }
        );

        if (updatedUser.modifiedCount === 1) {
          res.status(200).json({ message: "User updated successfully" });
        } else {
          res.status(400).json({ message: "User update failed" });
        }
      } catch (error) {
        console.error(error);
        res
          .status(500)
          .json({ message: "An error occurred while updating user data" });
      }
    });

    app.get("/users", async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    app.get("/requests", async (req, res) => {
      const result = await req.find().toArray();
      res.send(result);
    });

    app.get("/requests/all/:email", async (req, res) => {
      const email = req.params.email;
      const query = { "asset.HrEmail": email };
      const result = await requestsCollection.find(query).limit(5).toArray();
      res.send(result);
    });

    app.get("/requests/pending/:email", async (req, res) => {
      const email = req.params.email;
      const query = { "asset.HrEmail": email, status: "pending" };
      const result = await requestsCollection.find(query).limit(5).toArray();
      res.send(result);
    });


    app.get("/asset-details/:id", async (req, res) => {
      const id = req.params.id;

      // Validate ID
      if (!ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Invalid asset ID" });
      }

      try {
        const query = { _id: new ObjectId(id) };
        const result = await assetCollection.findOne(query);

        if (!result) {
          return res.status(404).json({ message: "Asset not found" });
        }

        res.status(200).json(result);
      } catch (error) {
        console.error("Error fetching asset details:", error);
        res
          .status(500)
          .json({ message: "An error occurred while fetching asset details" });
      }
    });

    app.put("/update-asset/:id", async (req, res) => {
      const id = req.params.id;
      const { name, type, quantity, image } = req.body;
    
      // Validation (check if required fields are provided)
      if (!name || !type || !quantity || !image) {
        return res.status(400).send({ message: "All fields are required." });
      }
    
      // Ensure that quantity is greater than zero
      if (quantity <= 0) {
        return res.status(400).send({ message: "Quantity must be greater than zero." });
      }
    
      // Create update query
      const query = { _id: new ObjectId(id) };
      const updateData = {
        $set: {
          name: name,
          type: type,
          quantity: quantity,
          image: image, // Image URL or file path
        },
      };
    
      try {
        // Find and update the asset
        const result = await assetCollection.updateOne(query, updateData);
    
        if (result.modifiedCount > 0) {
          return res.status(200).send({ message: "Asset updated successfully." });
        } else {
          return res.status(404).send({ message: "Asset not found." });
        }
      } catch (error) {
        console.error("Error updating asset:", error);
        return res.status(500).send({ message: "Failed to update asset. Please try again." });
      }
    });
    

    app.get("/users/:email", async (req, res) => {
      const query = { email: req.params.email };
      const result = await usersCollection.findOne(query);
      res.send(result);
    });

    app.post("/add-employee", async (req, res) => {
      const employee = req.body;
      const result = await employeeCollection.insertMany(employee);
      res.send(result);
    });

    app.get("/employees/:email", async (req, res) => {
      const query = { companyEmail: req.params.email };
      const result = await employeeCollection.find(query).toArray();
      res.send(result);
    });

    app.post("/assets", async (req, res) => {
      const { asset } = req.body;
      const result = await assetCollection.insertOne(asset);
      res.send(result);
    });

    app.get("/team/:email", async (req, res) => {
      const email = req.params.email;
      const query = { companyEmail: email };
      const result = await employeeCollection.find(query).toArray();
      res.send(result);
    });

    app.post("/assets/request", async (req, res) => {
      const requestInfo = req.body;

      try {
        const result = await requestsCollection.insertOne(requestInfo);
        res.send({
          success: true,
          message: "Request added successfully",
          data: result,
        });
      } catch (error) {
        console.error("Error adding request:", error);
        res
          .status(500)
          .send({ success: false, message: "Failed to add request", error });
      }
    });

    app.patch("/assets-update/:id", async (req, res) => {
      const assetId = req.params.id;

      try {
        // Find the asset and update its requests and quantity
        const result = await assetCollection.updateOne(
          { _id: new ObjectId(assetId) }, // Filter by asset ID
          {
            $inc: {
              requests: 1, // Increment requests by 1
              quantity: -1, // Decrement quantity by 1
            },
          }
        );

        if (result.modifiedCount > 0) {
          res.send({ success: true, message: "Asset updated successfully" });
        } else {
          res.status(404).send({ success: false, message: "Asset not found" });
        }
      } catch (error) {
        console.error("Error updating asset:", error);
        res
          .status(500)
          .send({ success: false, message: "Failed to update asset", error });
      }
    });

    app.get("/employee/requests/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await requestsCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/employee/monthly/requests/:email", async (req, res) => {
      const email = req.params.email;

      // Get the start and end of the current month
      const startOfMonth = new Date(
        new Date().getFullYear(),
        new Date().getMonth(),
        1
      );
      const endOfMonth = new Date(
        new Date().getFullYear(),
        new Date().getMonth() + 1,
        0
      );

      // Build the query
      const query = {
        email: email,
        requestDate: {
          $gte: startOfMonth.getTime(), // Greater than or equal to the start of the month
          $lte: endOfMonth.getTime(), // Less than or equal to the end of the month
        },
      };

      try {
        const result = await requestsCollection
          .find(query)
          .sort({ requestDate: -1 }) // Sort by requestDate in descending order (most recent first)
          .limit(4) // Limit the response to a maximum of 4 documents
          .toArray();
        res.send(result);
      } catch (error) {
        console.error("Error fetching monthly requests:", error);
        res.status(500).send({ error: "Failed to fetch monthly requests" });
      }
    });

    app.get("/employee/requests/pending/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email, status: "pending" };
      const result = await requestsCollection.find(query).limit(5).toArray();
      res.send(result);
    });

    app.get("/assets/:email", async (req, res) => {
      const query = { HrEmail: req.params.email };
      const result = await assetCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/asset-list/:email", async (req, res) => {
      const { email } = req.params;
      const { searchTerm, filterStatus, filterType, sortOrder } = req.query;

      // Building the query for filtering by HR email
      const query = { HrEmail: email };

      // Adding search functionality
      if (searchTerm) {
        query.name = { $regex: searchTerm, $options: "i" }; // Case-insensitive search
      }

      // Adding filter functionality for stock status (available/out-of-stock)
      if (filterStatus === "available") {
        query.quantity = { $gt: 0 }; // Only show assets with quantity > 0
      } else if (filterStatus === "out-of-stock") {
        query.quantity = { $eq: 0 }; // Only show assets with quantity = 0
      }

      // Adding filter functionality for asset type (returnable/non-returnable)
      if (filterType && filterType !== "all") {
        query.type = filterType; // Filter by asset type
      }

      // Sorting by quantity (ascending or descending)
      let sortQuery = {};
      if (sortOrder === "asc") {
        sortQuery.quantity = 1; // Ascending
      } else if (sortOrder === "desc") {
        sortQuery.quantity = -1; // Descending
      }

      try {
        const result = await assetCollection
          .find(query)
          .sort(sortQuery) // Sort based on quantity
          .toArray();
        res.send(result);
      } catch (error) {
        console.error("Error fetching assets:", error);
        res.status(500).send("Error fetching assets");
      }
    });

    app.get("/asset/most/:email", async (req, res) => {
      const query = { HrEmail: req.params.email, requests: { $gt: 2 } };
      const result = await assetCollection.find(query).limit(4).toArray();
      res.send(result);
    });

    app.get("/asset/limited/:email", async (req, res) => {
      const query = { HrEmail: req.params.email, quantity: { $lt: 10 } };
      const result = await assetCollection.find(query).limit(5).toArray();
      res.send(result);
    });

    app.get("/employees/list/:email", async (req, res) => {
      const query = { companyEmail: req.params.email };
      const result = await employeeCollection.find(query).toArray();
      res.send(result);
    });

    app.delete("/employees/remove/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await employeeCollection.deleteOne(query);
      res.send(result);
    });

    app.delete("/asset/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await assetCollection.deleteOne(query);
      res.send(result);
    });
  } catch (err) {
    console.error("Error connecting to MongoDB:", err.message);
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("server is working");
});

app.listen(port, () => {
  console.log(`server is running on port ${port}`);
});
