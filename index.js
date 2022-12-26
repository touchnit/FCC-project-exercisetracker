require('dotenv').config()
const express = require('express')
const app = express()
const cors = require('cors')
const Mongoose = require('mongoose')

Mongoose.connect(process.env.MONGO_CONNECT, { useNewUrlParser: true, useUnifiedTopology: true, useFindAndModify: false })

app.use(cors())
app.use(express.json());
app.use(express.urlencoded({ extended: true }))
app.use(express.static('public'))
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});

let userSchema = new Mongoose.Schema({
  username: { type: String, required: true },
  log: [{ type: Mongoose.Schema.Types.ObjectId, ref: 'Exercise' }],
  count: { type: Number },
})

let exerciseSchema = new Mongoose.Schema({
  id: { type: Mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  description: { type: String, required: true },
  duration: { type: Number, required: true },
  date: { type: Date },
})

let User = Mongoose.model('User', userSchema);
let Exercise = Mongoose.model('Exercise', exerciseSchema);

let userProjection = { username: 1 };

// Post request to add a new user
app.post('/api/users/', function (req, res) {
  let username = req.body.username
  User.findOne({ username: username }, userProjection, function (err, data) {
    if (err) return console.error(err)
    if (!data) {
      let user = new User({ username: username });
      user.save(function (err, data) {
        if (err) return console.error(err);
        console.log("user " + user.username + " saved sucessfully in database");
        res.json({ username: data.username, _id: data._id }) // still needs to be formatted correctly
      })
    }
    else {
      console.log("this user already exists in the database ;)")
      res.json({ username: data.username, _id: data._id })
    }
  })
})

app.get('/api/users/', async function (req, res) {
  let promise = new Promise((resolve, reject) => {
    User.find({}).select(userProjection).exec(function (err, data) {
      if (err) return console.error(err);
      resolve(data);
    })
  })
  let users = await promise;
  res.send(JSON.stringify(users));
})

app.post('/api/users/:_id/exercises', async function (req, res) {
  let id = req.params._id;
  let description = req.body.description;
  let duration = req.body.duration;
  let date = req.body.date ? req.body.date : new Date();
  let newExercise = new Exercise({
    id: id,
    description: description,
    duration: duration,
    date: date
  })
  let promise = new Promise((resolve, reject) => {
    newExercise.save(function (err, data) {
      if (err) return console.error(err);
      console.log("Exercise " + newExercise.description + " for user " + newExercise.id + " saved sucessfully in database");
      resolve(data)
      res.json(newExercise)
    })
  })
  let exerciseData = await promise
  console.log(promise)
  User.findOneAndUpdate({ _id: id }, {
    "$inc": { "count": 1 },
    "$push": { "log": exerciseData._id }
  }, function (err, data) {
    if (err) return console.error(err);
    console.log('User log ' + data._id + ' updated')
  })
}
)

app.get('/api/users/:_id/logs', function (req, res) {
  let logId = req.params._id;
  let fromDate = req.query.from ? new Date(req.query.from) : null;
  let toDate = req.query.to ? new Date(req.query.to) : null;
  let limit = req.query.limit ? { limit: req.query.limit } : {};

  let matchQuery = {};

  // Create From and To date options and store in matchQuery object if needed.
  if (fromDate || toDate) {
    matchQuery = `{ date : { $expr { ${fromDate ? "$gte: " + "ISODate(\"" + fromDate.toISOString() + "\")" : ""}${toDate && fromDate ? "," : ""} ${toDate ? "$lte: " + "ISODate(\"" + toDate.toISOString() + "\")" : ""} } } }`
  }

  console.log(matchQuery);

  User.find({ _id: logId }).populate({ path: 'log', select: 'description duration name date', match: matchQuery, options: limit }).select('username count _id log').exec(function (err, data) {
    if (err) return console.error(err);
    console.log(data)
    res.json(data);
  })
})

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})
