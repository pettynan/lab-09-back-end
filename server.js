'use strict';

require('dotenv').config();

const superagent = require('superagent');

const cors = require('cors');
const express = require('express');
const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;
const weatherArr = [];

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
    let queryData = request.query.data;
    let locUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${queryData}&key=${process.env.GEOCODEAPI}`;
    superagent.get(locUrl)
      .then(result=> {
        let loc = new Location(result.body);
        response.send(loc);
      });
  } catch(e) {
    response.status(500).send('Sorry something went wrong!');
    console.log(e);
  }
});

app.get('/weather', (request, response) => {
  try {
    let weaUrl = `https://api.darksky.net/forecast/${process.env.DARKSKYAPI}/${request.query.data.latitude},${request.query.data.longitude}`;
    superagent.get(weaUrl)
      .then(result => {
        let newWeatherArr = result.body.daily.data.map(element => {
          return new Weather(element);
        });
        response.send(newWeatherArr);
      });
  } catch(e) {
    response.status(500).send('Sorry something went wrong!');
  }
});

app.get('/events', (request, response) => {
  console.log('The event route start');
  try {
    let eventURL = `https://www.eventbriteapi.com/v3/events/search?location.longitude=${request.query.data.longitude}&location.latitude=${request.query.data.latitude}&token=${process.env.EVENBRIGHTOATH}`;
    console.log(eventURL);
    superagent.get(eventURL)
      .then(result => {
        console.log(result.body.events);
        let eventsArray = result.body.events.map((element) => {

          return new Events(element.url, element.name.text, element.start.local, element.description.text);
        });
        response.send(eventsArray);
        console.log('The EVENBRIGHT Results', eventsArray);
      })
  } catch(e) {
    response.status(500).send('Sorry something went wrong with events!',e);
  }
  });

app.listen(PORT, () => console.log(`Listening on port ${PORT}`));
