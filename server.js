'use strict';

require('dotenv').config();

const superagent = require('superagent');
const pg = require('pg');

const cors = require('cors');
const express = require('express');
const app = express();
app.use(cors());

const PORT = process.env.PORT || 8000;
const weatherArr = [];


const client = new pg.Client(process.env.DATABASE_URL);
client.connect();

const Location = function(obj){
  this.search_query = obj.results[0].address_components[0].long_name;
  this.formatted_query = obj.results[0].formatted_address;
  this.latitude = obj.results[0].geometry.location.lat;
  this.longitude = obj.results[0].geometry.location.lng;
};

const Weather = function(obj) {
  this.forecast = obj.summary;
  this.time = new Date(obj.time * 1000).toString().slice(0, 15);
  weatherArr.push(this);
};

const Events = function(link, name, eventDate, summary){
  this.link = link;
  this.name = name;
  this.event_date = eventDate;
  this.summary = summary;
};

app.get('/location', (request, response) => {
  try {
    let queryData = request.query.data.toLowerCase();
    let sqlQueryDataCheck = `SELECT * FROM location WHERE search_query = $1;`;
    let values = [queryData];

    client.query(sqlQueryDataCheck, values)
      .then((data) => {
        if(data.rowCount > 0){
          response.send(data.rows[0]);
        } else {
          let locUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${queryData}&key=${process.env.GEOCODE_API_KEY}`;
          superagent.get(locUrl)
            .then(result=> {
              let loc = new Location(result.body);
              let insertStatement = `INSERT INTO location (latitude, longitude, formatted_query, search_query) VALUES ($1, $2, $3, $4);`;
              let values = [loc.latitude, loc.longitude, loc.formatted_query, loc.search_query.toLowerCase()];
              client.query(insertStatement, values);
              console.log('DATA WAS ADDED TO THE DB', data.rows);
              response.send(loc);
            })
            .catch((error)=> {
              console.log('THERE\'S BEEN AN ERROR WITH SUPERAGENT', error);
            });
        }
      })
      .catch((error)=> {
        console.log('OH NO THERE\'S BEEN AN ERRORRRRRRRRR Querying data from the database.', error);
      });
  } catch(e) {
    response.status(500).send('Sorry something went wrong!');
    console.log(e);
  }
});

app.get('/weather', (request, response) => {
  try {
    let weaUrl = `https://api.darksky.net/forecast/${process.env.WEATHER_API_KEY}/${request.query.data.latitude},${request.query.data.longitude}`;
    let sqlQueryCheck = `SELECT * FROM weather WHERE search_query = $1;`;
    let values = [request.query.data.search_query];

    client.query(sqlQueryCheck, values)
      .then((data) => {
        if(data.rowCount > 0){
          response.send(data.rows);
        } else {
          superagent.get(weaUrl)
            .then(result => {
              let newWeatherArr = result.body.daily.data.map(element => {
                return new Weather(element);
              });
              newWeatherArr.forEach((item)=> {
                let insertStatement = `INSERT INTO weather (forecast, time, search_query) VALUES ($1, $2, $3);`;
                let values = [item.forecast, item.time, request.query.data.search_query];
                client.query(insertStatement, values);
              });
              response.send(newWeatherArr);
            });
        }
      })
      .catch((error) => {
        console.log('TROUBLE CHECK FOR WEATHER IN DB', error);
      });
  } catch(e) {
    response.status(500).send('Sorry something went wrong!');
  }
});

app.get('/events', (request, response) => {
  try {
    let sqlQueryCheck = `SELECT * FROM events WHERE search_query = $1;`;
    let values = [request.query.data.search_query];

    client.query(sqlQueryCheck, values)
      .then((data) =>{
        if(data.rowCount > 0){
          response.send(data.rows[0]);
        }
        else {
          let eventURL = `https://www.eventbriteapi.com/v3/events/search?location.longitude=${request.query.data.longitude}&location.latitude=${request.query.data.latitude}&token=${process.env.EVENTBRITE_API_KEY}`;
          superagent.get(eventURL)
            .then(result => {
              let eventsArray = result.body.events.map((element) => {
                return new Events(element.url, element.name.text, element.start.local, element.description.text);
              });
              eventsArray.forEach((item) => {
                let insertStatement = `INSERT INTO events (link, name, event_date, summary, search_query) VALUES ($1, $2, $3, $4, $5);`;
                let values = [item.link, item.name, item.event_date, item.summary, request.query.data.search_query];
                client.query(insertStatement, values);
              });
              response.send(eventsArray);
            });
        }
      })
      .catch((error) => {
        console.log('YOU FUCKED SHIT UP!!!', error);
      });


    
  } catch(e) {
    response.status(500).send('Sorry something went wrong with events!',e);
  }
});

app.listen(PORT, () => console.log(`Listening on port ${PORT}`));



// helper function
// const checkDB = (request, response, tableName) => {
//   let sqlQueryCheck = `SELECT * FROM ${tableName} WHERE search_query = $1;`;
//   let values = [request.query.data.search_query];

//   client.query(sqlQueryCheck, values)
//     .then((data) => {
//       if(data.rowCount > 0){
//         console.log(`THIS IS THE DATA ROWS FOR ${tableName}!!!!!!!! ${data.rows[0]}`);
//         return data.rows[0];
//       }
//     })
//     .catch((error)=> {
//       console.log(error);
//     });
// };


// const writeToDB = (request, response, tableName, tableColumnNames, values, valueData) => {
//   let insertStatement = `INSERT INTO ${tableName} (${tableColumnNames}) VALUES (${values});`;
//   let valuesToWrite = valueData;
//   client.query(insertStatement, valuesToWrite);
// };
