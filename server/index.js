// IMPORT STUFFS

const mysql = require('mysql');
const express = require('express');
var cors = require('cors')
var Config = require('./config.json');
var mongoDB = require('mongodb');

// MIDDLEWARE

const app = express();
app.use(cors());

// ESTABLISH MYSQL CONNECTION
// https://github.com/mysqljs/mysql

const db = mysql.createConnection({
  host     : Config.host,
  user     : Config.user,
  password : Config.password,
  database : Config.database
});


var MongoClient = mongoDB.MongoClient;
var url = "mongodb://localhost/";

db.connect(function(err) {
  if (err) {
    console.error('error connecting: ' + err.stack);
    return;
  }

  console.log('connected as id ' + db.threadId);
});

// RETRIEVE THREADS FOR FRONTPAGE

app.get('/frontpage_threads',(req,res)=>{

  param = JSON.parse(req.query.param);
  orderbyscore = req.query.orderbyscore;

  let sql_component = '';
  var i = 0;
  var values = []

  for (const [key, value] of Object.entries(param)) {

    values.push(value)
    if (i==0)
      {sql_component += 'AND (t.subforum_id = ?';}
    else
      {sql_component += ' OR t.subforum_id = ?';}
    i+=1

  }

  if (i != 0){
    sql_component += ") "
  }

  console.log(orderbyscore)

  let sql = 'SELECT * \
             FROM thread t JOIN user_details u ON u.user_id = t.user_id \
             WHERE removed=0 '+sql_component+'\
             ORDER BY  CAST(t.created_utc/(360) AS INT) DESC, t.score DESC, t.created_utc DESC \
             LIMIT 5000';

  if (orderbyscore == "true")
  {
    console.log("hello")
    sql = 'SELECT * \
               FROM thread t JOIN user_details u ON u.user_id = t.user_id \
               WHERE removed=0 '+sql_component+'\
               ORDER BY  t.score DESC, t.created_utc DESC \
               LIMIT 5000'; //CAST(t.created_utc/(360) AS INT) DESC,
  }

  db.query({
    sql: sql,
    timeout: 40000, // 40s
    values: values
  }, function (error, results, fields) {
    if (error) {
      console.error('error connecting: ' + error.stack);
      return;
    }
    res.send(results);
    // error will be an Error if one occurred during the query
    // results will contain the results of the query
    // fields will contain information about the returned results fields (if any)
  });
});

// RETRIEVE USER DETAILS FOR LOGIN AUTHENTICATION

app.get('/authenticate',(req, res)=>{
  user_name = req.query.user_name;

  let sql = 'SELECT user_id, password FROM user_details WHERE user_name = ?;';
  db.query({
    sql: sql,
    timeout: 40000,
    values: [user_name.toLowerCase()]
  }, function(error, results, fields) {
    if (error) {
      console.error('error connecting: ' + error.stack);
      return;
    }
    res.send(JSON.stringify(results));
  });
});

// UPDATE USER DETAILS FOR NEW SIGNUP

app.get('/signup',(req,res)=>{

  username = req.query.username;
  email = req.query.email;
  password = req.query.password;

  let sql = 'INSERT INTO user_details (user_name, email, karma, password) VALUES (?, ?, 0, ?);'

  db.query({
    sql: sql,
    timeout: 40000, // 40s
    values: [username.toLowerCase(), email, password],
  }, function (error, results, fields) {
    if (error) {
      console.error('error connecting: ' + error.stack);
      return;
    }
    res.send(results);
  });
});

// RETRIEVE USER DETAILS

app.get('/userdetails',(req,res)=>{

  username = req.query.username;

  let sql = 'SELECT user_id, user_name, email, karma FROM user_details WHERE user_name = ?';

  db.query({
    sql: sql,
    timeout: 40000, // 40s
    values: [username.toLowerCase()],
  }, function (error, results, fields) {
    if (error) {
      console.error('error connecting: ' + error.stack);
      return;
    }
    res.send(results);
  });
});

// RETRIEVE MODERATOR STATUS FOR A USER AND SUBFORUM

app.get('/moderator_status',(req, res)=>{

  user_id = req.query.user_id;
  subforum_id = req.query.subforum_id;

  let sql = 'SELECT * FROM moderates WHERE user_id = ? AND subforum_id = ?;';
  db.query({
    sql: sql,
    timeout: 40000,
    values: [user_id,subforum_id]
  }, function(error, results, fields) {
    if (error) {
      console.error('error connecting: ' + error.stack);
      return;
    }

    if(results.length!=0){
      res.send(true);
    }
    else{
      res.send(false);
    }
  });
});

// RETRIEVE ALL SUBCATEGORIES FOR POST CREATION

app.get('/all_subcategories',(req,res)=>{

  let sql = 'SELECT subforum_id, name FROM subforum';

  db.query({
    sql: sql,
    timeout: 40000, // 40s
  }, function (error, results, fields) {
    if (error) {
      console.error('error connecting: ' + error.stack);
      return;
    }
    res.send(results);
  });
});

// delete threads

app.get('/delete_thread',(req, res)=>{
  thread_id = req.query.thread_id;

  let sql = 'UPDATE thread SET removed=1 WHERE thread_id = ?;';
  db.query({
    sql: sql,
    timeout: 40000,
    values: [thread_id]
  }, function(error, results, fields) {
    if (error) {
      console.error('error connecting: ' + error.stack);
      res.send("unsuccessful");
      return;
    }
    else{
      res.send("success");
    }
  });
});

// delete comments

app.get('/delete_comments',(req, res)=>{

  comment_id = req.query.comment_id;
  parent_id = req.query.parent_id;


  var MongoClient = mongoDB.MongoClient;
  var url = "mongodb://localhost/";

  MongoClient.connect(url, { useNewUrlParser: true }, function(err, db) {
    if (err) throw err;
    var dbo = db.db("reddit");
    dbo.collection("comments").updateOne(
      {'_id': parent_id, 'child._id': comment_id},
      { $set: { 'child.$.removed': 1 }},
      {},
      function(err, result) {

        if (err) {
          res.send("unsuccessful");
          throw err;
        }
        else{
          res.send("success");
        }
        db.close();
      });
  });
});

// INSERT POST

app.get('/create_post',(req,res)=>{

  subforum_id = req.query.subforum_id;
  body = req.query.body;
  title = req.query.title;
  user_id = req.query.user_id;


  let sql = 'INSERT into thread (title,body,user_id,created_utc,score,subforum_id,removed) \
             VALUES (?,?,?,UNIX_TIMESTAMP(),1,?,0)';

  db.query({
    sql: sql,
    timeout: 40000,
    values: [title,body,user_id,subforum_id]
  }, function (error, results, fields) {
    if (error) {
      console.error('error connecting: ' + error.stack);
      return;
    }
    res.send(results);
  });
});

// RETRIEVE CATEGORIES FOR SIDE BAR IN FRONTPAGE

app.get('/categories',(req,res)=>{

  let sql = 'SELECT * FROM category';

  db.query({
    sql: sql,
    timeout: 40000, // 40s
  }, function (error, results, fields) {
    if (error) {
      console.error('error connecting: ' + error.stack);
      return;
    }
    res.send(results);
  });
});

// RETRIEVE SUBCATEGORIES (SUBFORUMS) FOR SIDE BAR IN FRONTPAGE

app.get('/subcategories',(req,res)=>{

  category_id = req.query.category_id;

  let sql = 'SELECT * FROM subforum WHERE category_id = ?';

  db.query({
    sql: sql,
    timeout: 40000,
    values: [category_id]
  }, function (error, results, fields) {
    if (error) {
      console.error('error connecting: ' + error.stack);
      return;
    }
    res.send(results);
  });
});

// RETRIEVE CATEGORY AND SUBCATEGORY OF A SELECTED THREAD

app.get('/description',(req,res)=>{

  thread_id = req.query.thread_id;

  let sql = 'SELECT c.name as category_name,s.name as subforum_name, c.description as category_description, s.description as subforum_description \
             FROM (thread t JOIN subforum s ON t.subforum_id = s.subforum_id) JOIN category c ON s.category_id = c.category_id \
             WHERE t.thread_id = ?';

  db.query({
    sql: sql,
    timeout: 40000, // 40s
    values: [thread_id]
  }, function (error, results, fields) {
    if (error) {
      console.error('error connecting: ' + error.stack);
      return;
    }

    res.send(results);
  });
});

//grab subscriptions for a given user
app.get('/subscriptions',(req, res) =>{
  user_id = req.query.user_id
  subforum_id = req.query.subforum_id;


  let sql = 'SELECT * \
             FROM subscribes as sub \
             JOIN subforum ON subforum.subforum_id = sub.subforum_id \
             WHERE sub.user_id = ? AND sub.subforum_id = ?';

  db.query({
    sql: sql,
    timeout: 40000, // 40s
    values: [user_id, subforum_id]
  }, function (error, results, fields) {
    if (error) {
      console.error('error connecting: ' + error.stack);
      return;
    }

    res.send(results);
  });
});

//create a subscription for a given user and given forum
app.get('/create_subscription',(req, res) =>{
  user_id = req.query.user_id
  subforum_id = req.query.subforum_id;


  let sql = 'INSERT INTO subscribes (user_id, subforum_id) \
             VALUES (?, ?)';

  db.query({
    sql: sql,
    timeout: 40000, // 40s
    values: [user_id, subforum_id]
  }, function (error, results, fields) {
    if (error) {
      console.error('error connecting: ' + error.stack);
      return;
    }

    res.send(results);
  });
});

//deletes a subscription for a given user
app.get('/delete_subscription',(req, res) =>{
  user_id = req.query.user_id
  subforum_id = req.query.subforum_id;


  let sql = 'DELETE FROM subscribes \
             WHERE user_id = ? AND subforum_id = ?';

  db.query({
    sql: sql,
    timeout: 40000, // 40s
    values: [user_id, subforum_id]
  }, function (error, results, fields) {
    if (error) {
      console.error('error connecting: ' + error.stack);
      return;
    }

    res.send(results);
  });
});

//gets a vote for a given user and thread
app.get('/get_thread_vote',(req, res) =>{
  user_id = req.query.user_id
  thread_id = req.query.thread_id;


  let sql = 'SELECT * \
             FROM thread_votes \
             WHERE user_id = ? AND thread_id = ?';

  db.query({
    sql: sql,
    timeout: 40000, // 40s
    values: [user_id, thread_id]
  }, function (error, results, fields) {
    if (error) {
      console.error('error connecting: ' + error.stack);
      return;
    }

    res.send(results);
  });
});

//creates a vote for a given user and thread
app.get('/create_thread_vote',(req, res) =>{
  user_id = req.query.user_id
  thread_id = req.query.thread_id;
  sentiment = req.query.sentiment;

  let sql = 'INSERT INTO thread_votes (user_id, thread_id, sentiment) \
             VALUES (?, ?, ?)';

  db.query({
    sql: sql,
    timeout: 40000, // 40s
    values: [user_id, thread_id, sentiment]
  }, function (error, results, fields) {
    if (error) {
      console.error('error connecting: ' + error.stack);
      return;
    }

    res.send(results);
  });
});

//deletes a vote for a given user and thread
app.get('/delete_thread_vote',(req, res) =>{
  user_id = req.query.user_id
  thread_id = req.query.thread_id;


  let sql = 'DELETE FROM thread_votes \
             WHERE user_id = ? AND thread_id = ?';

  db.query({
    sql: sql,
    timeout: 40000, // 40s
    values: [user_id, thread_id]
  }, function (error, results, fields) {
    if (error) {
      console.error('error connecting: ' + error.stack);
      return;
    }

    res.send(results);
  });
});

//updates a vote for a given user and thread
app.get('/update_thread_vote',(req, res) =>{
  user_id = req.query.user_id
  thread_id = req.query.thread_id;
  sentiment = req.query.sentiment

  let sql = 'UPDATE thread_votes \
             SET sentiment = ? \
             WHERE user_ID = ? AND thread_id = ?';

  db.query({
    sql: sql,
    timeout: 40000, // 40s
    values: [sentiment, user_id, thread_id]
  }, function (error, results, fields) {
    if (error) {
      console.error('error connecting: ' + error.stack);
      return;
    }

    res.send(results);
  });
});

//returns a vote for a given user_id and comment_id
app.get('/get_comment_vote',(req, res) =>{
  user_id = req.query.user_id
  comment_id = req.query.comment_id;

  let sql = 'SELECT * \
             FROM comment_votes \
             WHERE user_id = ? AND comment_id = ?';

  db.query({
    sql: sql,
    timeout: 40000, // 40s
    values: [user_id, comment_id]
  }, function (error, results, fields) {
    if (error) {
      console.error('error connecting: ' + error.stack);
      return;
    }

    res.send(results);
  });
});

//create a comment vote for a given user_id and comment_id
app.get('/create_comment_vote',(req, res) =>{
  user_id = req.query.user_id;
  comment_id = req.query.comment_id;
  sentiment = req.query.sentiment;
  comment_score = req.query.comment_score;
  parent_id = req.query.parent_id

  let sql = 'INSERT INTO comment_votes (user_id, comment_id, sentiment) \
             VALUES (?, ?, ?)';

  db.query({
    sql: sql,
    timeout: 40000, // 40s
    values: [user_id, comment_id, sentiment]
  }, function (error, results, fields) {
    if (error) {
      console.error('error connecting: ' + error.stack);
      return;
    }


    var MongoClient = mongoDB.MongoClient;
    var url = "mongodb://localhost/";

    MongoClient.connect(url, { useNewUrlParser: true }, function(err, db_) {
      if (err) throw err;
      var dbo = db_.db("reddit");
      dbo.collection("comments").updateOne(
        {'_id': parent_id, 'child._id': comment_id},
        { $set: { 'child.$.score': parseInt(comment_score)+parseInt(sentiment) }},
        {},
        function(err, result) {

          if (err) {
            res.send("unsuccessful");
            throw err;
          }
          else{
            MongoClient.connect(url, { useNewUrlParser: true }, function(err, db__) {
            if (err) throw err;
            var dbo_ = db__.db("reddit");
            dbo_.collection("comments").aggregate([{ $unwind : "$child" }, { $match : { "child._id" : comment_id } }]).toArray(
            function(err, result) {
              console.log(result)
              if (err) {
                res.send("unsuccessful");
                throw err;
              }
              else{

                let sql = "UPDATE user_details SET karma = karma + ? WHERE user_name = ?";

                user_name = result[0].child.user_name

                db.query({
                  sql: sql,
                  timeout: 40000, // 40s
                  values: [parseInt(sentiment),user_name.toLowerCase()]
                }, function (error, results, fields) {
                  if (error) {
                    console.error('error connecting: ' + error.stack);
                    return;
                  }
                  console.log(results)

                  res.send("success");
                });
              }
            });
          });
          }
        });
        db_.close();
      });

    });
 });

//delete a comment vote for a given user_id and comment_id
app.get('/delete_comment_vote',(req, res) =>{
  user_id = req.query.user_id;
  comment_id = req.query.comment_id;
  comment_score = req.query.comment_score;
  sentiment = req.query.sentiment,
  parent_id = req.query.parent_id

  let sql = 'DELETE FROM comment_votes \
             WHERE user_id = ? AND comment_id = ?';

  db.query({
    sql: sql,
    timeout: 40000, // 40s
    values: [user_id, comment_id]
  }, function (error, results, fields) {
    if (error) {
      console.error('error connecting: ' + error.stack);
      return;
    }

    var MongoClient = mongoDB.MongoClient;
    var url = "mongodb://localhost/";

    MongoClient.connect(url, { useNewUrlParser: true }, function(err, db_) {
      if (err) throw err;
      var dbo = db_.db("reddit");
      dbo.collection("comments").updateOne(
        {'_id': parent_id, 'child._id': comment_id},
        { $set: { 'child.$.score': parseInt(comment_score)-parseInt(sentiment) }},
        {},
        function(err, result) {

          if (err) {
            res.send("unsuccessful");
            throw err;
          }
          else{
            MongoClient.connect(url, { useNewUrlParser: true }, function(err, db__) {
            if (err) throw err;
            var dbo_ = db__.db("reddit");
            dbo_.collection("comments").aggregate([{ $unwind : "$child" }, { $match : { "child._id" : comment_id } }]).toArray(
            function(err, result) {
              console.log(result)
              if (err) {
                res.send("unsuccessful");
                throw err;
              }
              else{

                let sql = 'UPDATE user_details SET karma = karma - ? WHERE user_name = ?';

                user_name = result[0].child.user_name

                db.query({
                  sql: sql,
                  timeout: 40000, // 40s
                  values: [parseInt(sentiment),user_name.toLowerCase()]
                }, function (error, results, fields) {
                  if (error) {
                    console.error('error connecting: ' + error.stack);
                    return;
                  }

                  res.send("success");
                });
              }
            });
          });
          }
        });
        db_.close();
      });
  });
});

//update a comment vote for a given user_id and comment_id
app.get('/update_comment_vote',(req, res) =>{
  user_id = req.query.user_id;
  comment_id = req.query.comment_id;
  sentiment = req.query.sentiment;
  parent_id = req.query.parent_id;
  comment_score = req.query.comment_score;

  let sql = 'UPDATE comment_votes \
             SET sentiment = ? \
             WHERE user_ID = ? AND comment_id = ?';

  db.query({
    sql: sql,
    timeout: 40000, // 40s
    values: [sentiment, user_id, comment_id]
  }, function (error, results, fields) {
    if (error) {
      console.error('error connecting: ' + error.stack);
      return;
    }

    var MongoClient = mongoDB.MongoClient;
    var url = "mongodb://localhost/";

    MongoClient.connect(url, { useNewUrlParser: true }, function(err, db_) {
      if (err) throw err;
      var dbo = db_.db("reddit");
      dbo.collection("comments").updateOne(
        {'_id': parent_id, 'child._id': comment_id},
        { $set: { 'child.$.score': parseInt(comment_score)+2*parseInt(sentiment) }},
        {},
        function(err, result) {

          if (err) {
            res.send("unsuccessful");
            throw err;
          }
          else{
            MongoClient.connect(url, { useNewUrlParser: true }, function(err, db__) {
            if (err) throw err;
            var dbo_ = db__.db("reddit");
            dbo_.collection("comments").aggregate([{ $unwind : "$child" }, { $match : { "child._id" : comment_id } }]).toArray(
            function(err, result) {
              console.log(result)
              if (err) {
                res.send("unsuccessful");
                throw err;
              }
              else{

                let sql = 'UPDATE user_details SET karma = karma + ? WHERE user_name = ?';

                user_name = result[0].child.user_name

                db.query({
                  sql: sql,
                  timeout: 40000, // 40s
                  values: [2*parseInt(sentiment),user_name.toLowerCase()]
                }, function (error, results, fields) {
                  if (error) {
                    console.error('error connecting: ' + error.stack);
                    return;
                  }

                  res.send("success");
                });
              }
            });
          });
          }
        });
        db_.close();
      });
  });
});

/* Backup code ---> using cursor to iterate through rows

app.get('/comments',(req,res)=>{

  thread_id = req.query.thread_id;

  var MongoClient = mongoDB.MongoClient;
  var url = "mongodb://localhost/";
  var comments_list = []

  MongoClient.connect(url, { useNewUrlParser: true }, function(err, db) {
    if (err) throw err;
    var dbo = db.db("reddit");
    var cursor = dbo.collection("comments").find({parent_id: "t"+thread_id});
    cursor.forEach(function(doc,err){
      comments_list.push(doc)
    },function(){
      db.close();
      res.send(comments_list);
    });
  });
});

*/
app.get('/comments',(req,res)=>{

  thread_id = req.query.thread_id;

  console.log(thread_id)

  var MongoClient = mongoDB.MongoClient;
  var url = "mongodb://localhost/";

  MongoClient.connect(url, { useNewUrlParser: true }, function(err, db) {
    if (err) throw err;
    var dbo = db.db("reddit");
    dbo.collection("comments").findOne({_id: "t"+thread_id}, function(err, result) {
        console.log(result)
        if (err) throw err;
        if (result==null){
          output = [];
        }
        else
        {
          output = result.child;
        }
        db.close();
        res.send(output);
      });
  });
});

app.get('/subcomments',(req,res)=>{

  comment_id = req.query.comment_id;

  var MongoClient = mongoDB.MongoClient;
  var url = "mongodb://localhost/";

  MongoClient.connect(url, { useNewUrlParser: true }, function(err, db) {
    if (err) throw err;
    var dbo = db.db("reddit");
    dbo.collection("comments").findOne({_id: comment_id}, function(err, result) {
        if (err) throw err;
        if (result==null){
          output = [];
        }
        else
        {
          output = result.child;
        }
        db.close();
        res.send(output);
      });
  });
});

app.get('/create_comment',(req,res)=>{

  body = req.query.body;
  parent_id = req.query.parent_id;
  username = req.query.username;
  timestamp = Math.floor(Date.now() / 1000);

  unique_id = '_' + Math.random().toString(36).substr(2, 9)

  to_insert = {_id: unique_id,body: body,score:1, user_name: username.toLowerCase(), removed: 0, created_utc:timestamp}

  var MongoClient = mongoDB.MongoClient;
  var url = "mongodb://localhost/";

  MongoClient.connect(url, { useNewUrlParser: true }, function(err, db) {
    if (err) throw err;
    var dbo = db.db("reddit");
    dbo.collection("comments").updateOne(
      {_id: parent_id},
      { $push: { child: to_insert }},
      { upsert: true },
      function(err, result) {
        if (err) {
          res.send("unsuccessful");
          throw err;
        }
        else{
          res.send("success");
        }
        db.close();
      });
  });
});


// ESTABLISH SERVER PORT

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => console.log('Server started on port '+PORT));
