DROP TABLE IF EXISTS weather, events, movies, location;

CREATE TABLE location (
  id SERIAL,
  latitude DECIMAL,
  longitude DECIMAL,
  formatted_query TEXT,
  search_query TEXT
);

CREATE TABLE weather (
  id SERIAL,
  forecast TEXT,
  time TEXT,
  search_query TEXT
);

CREATE TABLE events (
  id SERIAL,
  link TEXT,
  name TEXT,
  event_date TEXT,
  summary TEXT,
  search_query TEXT
);

CREATE TABLE movies (
  id SERIAL,
  title TEXT,
  overview TEXT,
  average_votes DECIMAL,
  total_votes NUMERIC,
  image_url TEXT,
  popularity DECIMAL,
  released_on TEXT,
  search_query TEXT
);