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

// Constructor Functions
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
  this.event_date = eventDate.slice(0, 10);
  this.summary = `${summary.slice(0, 512)}...`;
};

const Movies = function(obj) {
  this.title = obj.title;
  this.overview = obj.overview;
  this.average_votes = obj.vote_average;
  this.total_votes = obj.vote_count;
  this.image_url = `https://image.tmdb.org/t/p/w370_and_h556_bestv2${obj.poster_path}`;
  this.popularity = obj.popularity;
  this.released_on = obj.release_date;
};

const Yelp = function(obj) {
  this.name = obj.name;
  this.image_url = obj.image_url;
  this.price = obj.price;
  this.rating = obj.rating;
  this.url = obj.url;
};

// Location Endpoint
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
    response.status(500).send('Sorry something went wrong with location!');
    console.log(e);
  }
});

// Weather Endpoint
app.get('/weather', (request, response) => {
  try {
    checkDB(request, response, 'weather');
  } catch(e) {
    response.status(500).send('Sorry something went wrong with weather!');
  }
});

// Events Endpoint
app.get('/events', (request, response) => {
  try {
    checkDB(request, response, 'events');
  } catch(e) {
    response.status(500).send('Sorry something went wrong with events!',e);
  }
});

// Movies Endpoint
app.get('/movies', (request, response) => {
  try {
    checkDB(request, response, 'movies');
  } catch(e) {
    response.status(500).send('Sorry something went wrong with movies!',e);
  }
});

// Yelp Endpoint
app.get('/yelp', (request, response) => {
  try {
    checkDB(request, response, 'yelp');
  } catch(e) {
    response.status(500).send('Sorry something went wrong with yelp!', e);
  }
});

// Console logs PORT when server is listening
app.listen(PORT, () => console.log(`Listening on port ${PORT}`));


// Helper function to check whether or not search query is already cached.
const checkDB = (request, response, tableName) => {
  let sqlQueryCheck = `SELECT * FROM ${tableName} WHERE search_query = $1;`;
  let values = [request.query.data.search_query];


  client.query(sqlQueryCheck, values)
    .then((data) => {
      if (data.rowCount > 0) {
        return response.send(data.rows);
      } else if (tableName === 'weather') {
        return weatherAPICall(request);
      } else if (tableName === 'events') {
        return eventsAPICall(request);
      } else if (tableName === 'movies') {
        return moviesAPICall(request);
      } else if (tableName === 'yelp') {
        return yelpAPICall(request);
      }
    })
    .catch((error)=> {
      console.log(error);
    });
};

// Helper function to make API call and cache Weather Data of unknown search queries.
const weatherAPICall = (request) => {
  let weaUrl = `https://api.darksky.net/forecast/${process.env.WEATHER_API_KEY}/${request.query.data.latitude},${request.query.data.longitude}`;
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
      return newWeatherArr;
    });
};

// Helper function to make API call and cache Event Data of unknown search queries.
const eventsAPICall = (request) => {
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
      return eventsArray;
    });
};

// Helper function to make API call and cache Movie Data of unknown search queries.
const moviesAPICall = (request) => {
  let movieURL = `https://api.themoviedb.org/3/discover/movie?api_key=${process.env.MOVIE_API_KEY}&sort_by=popularity.desc&include_adult=false&include_video=false&page=1`;
  superagent.get(movieURL)
    .then(result => {
      let moviesArray = result.body.results.map((element) => {
        return new Movies(element);
      });
      moviesArray.forEach((item) => {
        let insertStatement = `INSERT INTO movies (title, overview, average_votes, total_votes, image_url, popularity, released_on, search_query) VALUES ($1, $2, $3, $4, $5, $6, $7, $8);`;
        let values = [item.title, item.overview, item.average_votes, item.total_votes, item.image_url, item.popularity, item.released_on, request.query.data.search_query];
        client.query(insertStatement, values);
      });

      return moviesArray;
    });
};

// Helper function to make API call and cache Yelp Data of unknown search queries.
const yelpAPICall = (request) => {
  console.log('inside yelpApiCall');
  let yelpURL = `https://api.yelp.com/v3/businesses/search?latitude=${request.query.data.latitude}&longitude=${request.query.data.longitude}`;
  superagent.get(yelpURL)
    .set({Authorization: `Bearer ${process.env.YELP_API_KEY}`})
    .then(result => {
      console.log('superagent worked');
      let yelpsArray = result.body.businesses.map((element) => {
        return new Yelp(element);
      });
      yelpsArray.forEach((item) => {
        let insertStatement = `INSERT INTO yelp (name, image_url, price, rating, url, search_query) VALUES ($1, $2, $3, $4, $5, $6);`;
        let values = [item.name, item.image_url, item.price, item.rating, item.url, request.query.data.search_query];
        client.query(insertStatement, values);
      });

      return yelpsArray;
    });
};
