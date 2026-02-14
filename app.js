require('dotenv').config();
require('./utils/database');
var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var expressLayouts = require('express-ejs-layouts');

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(expressLayouts);

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/api', usersRouter); // Mount API routes at /api prefix

//Error handler for APIs
app.use((err, req, res, next) => {
  const statusCode = res.statusCode && res.statusCode !== 200 ? res.statusCode : 500;

  let result = {
    message: err.message || "Internal Server Error",
    status: statusCode,
    data: null,
  };

  //Add Stacktrace in development mode only
  if (process.env.NODE_ENV == "development") {
    result.stack = err.stack;
  }

  res.status(statusCode).json(result);
});

module.exports = app;
