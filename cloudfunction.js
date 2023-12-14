const { format } = require('util');
const mysql = require('promise-mysql');
const fs = require('fs');
const vision = require('@google-cloud/vision');
const { Console } = require('console');
const util = require('util');
const { Storage } = require('@google-cloud/storage');
const storage = new Storage();

const projectId = 'green-wares-399602';
process.env.GOOGLE_APPLICATION_CREDENTIALS = './key.json';

// Create a connection pool
const createTcpPool = async config => {
  const dbConfig = {
    host: 'HOST NAME',
    port: 'PORT',
    user: 'ROOT',
    password: 'PASSWORD',
    database: 'DB NAME',
    connectTimeout: 20000,
  };
  return mysql.createPool(dbConfig);
};

// Moved the queryAsync function definition here
const queryAsync = async (connection, query) => {
  const result = await util.promisify(connection.query).bind(connection)(query);
  return result;
};

exports.gettags = async (req, res) => {
  try {
    if (req.method === 'POST') {
      res.set('Access-Control-Allow-Origin', '*');
      res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
      res.set('Access-Control-Allow-Headers', 'Content-Type');
      
      }
    // In your Cloud Function response
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    console.log("start");
    var sendString = '';
    const stat = req.body.stat;
    // Get a connection from the pool
    const pool = await createTcpPool();
    const connection = await pool.getConnection();
    console.log('Connection obtained');

    if (stat == 1) {
      // To authenticate the User or to add a new user
      var email = req.body.email;
      var password = req.body.password;
      var query_str = "SELECT email,password from UserGeneratedTags where email='" + email + "'";
      console.log("going to query 1 ");

      const results = await queryAsync(connection, query_str);

      // Check the number of rows returned
      if (results.length === 0) {
        query_str = "INSERT INTO UserGeneratedTags (email,password,tags) VALUES ('" + email + "','" + password + "','')";
        await queryAsync(connection, query_str);
        console.log("added user");
        sendString = "authenticUser";
      } else {
        if (password === results[0].password) {
          console.log("matching pass");
          sendString = "authenticUser";
        } else {
          sendString = "authenticUserNot";
        }
      }
    } else if (stat == 2) {
      var email = req.body.email;
      const fileBuffer = req.body.file;
 
      const request = {
        image: {
          content: Buffer.from(fileBuffer, 'base64')
        }
      };
      const client = new vision.ImageAnnotatorClient();
      const [result] = await client.labelDetection(request);
      const labels = result.labelAnnotations;
      var tag_str = '';
      var all_tags_str = '';

      labels.forEach(label => {
        tag_str = tag_str + label.description + ",";
      });

      console.log(tag_str);

      query_str = "SELECT tags from UserGeneratedTags WHERE email='" + email + "'";
      const tagResult = await queryAsync(connection, query_str);
      all_tags_str = tagResult[0].tags + tag_str;

      query_str = "UPDATE UserGeneratedTags SET tags ='" + all_tags_str + "' WHERE email='" + email + "'";
      await queryAsync(connection, query_str);

      console.log("tags updated");
      const responseString = `${tag_str}:${all_tags_str}`;
      sendString = responseString;
      
    }

    console.log(sendString);
    res.send(sendString);

    // Release the connection after use
    connection.release();
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send(`Error processing the request: ${error.message}`);
  }
};
