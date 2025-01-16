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
      const query={companyEmail:req.params.email}
      const result = await employeeCollection.find(query).toArray();
      res.send(result);
    });

    app.post("/assets", async (req, res) => {
      const { asset } = req.body;
      const result = await assetCollection.insertOne(asset);
      res.send(result);
    });

    app.get("/assets/:email", async (req, res) => {
      const query={HrEmail:req.params.email};
      const result = await assetCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/asset-list/:email", async (req, res) => {
      const query = { HrEmail: req.params.email };
      const result = await assetCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/employees/list/:email",async(req,res)=>{
      const query={companyEmail:req.params.email};
      const result=await employeeCollection.find(query).toArray();
      res.send(result)
    })




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
