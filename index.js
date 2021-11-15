const express = require('express');
const { MongoClient } = require('mongodb');
const admin = require("firebase-admin");
// const ObjectId = require('mongodb').ObjectId;
const cors = require('cors');
const app = express();
const port = process.env.PORT || 5000;
require('dotenv').config();

app.use(cors());
app.use(express.json());

//doctors-portal-firebase-adminsdk.json
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

//Connection with database
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.e97ot.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

//Middle wire function
async function verifyToken (req, res, next){
  if(req.headers?.authorization?.startsWith('Bearer ')){
    const token = req.headers.authorization.split(' ')[1];

    try{
      const decodedUser = await admin.auth().verifyIdToken(token);
      req.decodedEmail = decodedUser.email;
    }
    catch{

    }
  }
  next();
}

//For Database user connection
async function run(){
  try{
    await client.connect();
    const database = client.db("doctors_portal");
    const appointmentCollection = database.collection("appointments");
    const usersCollection = database.collection("users");

    //POST API: Post Appointment from React UI to Mongodb Start
    app.post('/appointments', verifyToken, async(req, res) => {
      const appointment = req.body;
      const result = await appointmentCollection.insertOne(appointment);
      res.json(result)
    });
    //POST API: Post Appointment from React UI to Mongodb End

    //POST API: Users Data from React UI Register to Mongodb Start
    app.post('/users', async(req, res) => {
      const user = req.body;
      const result = await usersCollection.insertOne(user);
      res.json(result)
    });
    //POST API: Users Data from React UI Register to Mongodb End

    //For admin user Start
    app.get('/users/:email', async(req, res) => {
      const email = req.params.email;
      const query = {email: email};
      const user = await usersCollection.findOne(query);
      let isAdmin = false;
      if(user?.role === 'admin'){
        isAdmin = true;
      }
      res.json({admin: isAdmin})
    })
    //For admin user End

    //PUT API: Users Data from React UI Google Sign In to Mongodb Start (Upsert)
    app.put('/users', async(req, res) => {
      const user = req.body;
      const filter = {email: user.email};
      const options = {upsert: true};
      const updateDoc = {$set: user};
      const result = await usersCollection.updateOne(filter, updateDoc, options);
      console.log('added user', result)
      res.json(result)
    });
    //PUT API: Users Data from React UI Google Sign In to Mongodb Start

    app.put('/users/admin', verifyToken, async(req, res) => {
      const user = req.body;
      const requester = req.decodedEmail;
      if(requester){
        const requesterAccount = await usersCollection.findOne({email: requester});
        if(requesterAccount.role === 'admin'){
          const filter = {email: user.email};
          const updateDoc = {$set: {role: 'admin'}};
          const result = await usersCollection.updateOne(filter, updateDoc);
          res.json(result);
        }
      }
      else{
        res.status(403).json({message: 'You do not have access to make Admin'})
      }
      
    })

    //GET API: Get Appointments from Mongodb to React website Start
    app.get('/appointments', async (req, res) => {
      const email = req.query.email;
      const date = req.query.date;
      console.log(date);
      const query = { email: email, date: date }
      const cursor = appointmentCollection.find(query);
      const appointments = await cursor.toArray();
      res.json(appointments);
    })
    //GET API: Get Appointments from Mongodb to React website End

  }
  finally{
    // await client.close();
  }
}
run().catch(console.dir)

app.get('/', (req, res) => {
    res.send('Server is Running')
});
app.listen(port, () =>{
    console.log('Running server on port', port)
});