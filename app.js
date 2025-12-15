import debug from 'debug';
import express from 'express';
import path from 'path';
import logger from 'morgan';
import cookieParser from 'cookie-parser';
import createError from 'http-errors';
import http from 'http';
import {fileURLToPath} from 'url';
import {dirname} from 'path';

import indexRouter from './routes/index.js';
import intraRouter from './routes/intra.js';
import { requireAuth } from './middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import lanbookingRouter from './routes/lanbooking.js';
import lanregistrationRouter from './routes/lanregistration.js';
import lanFeedbackRouter from './routes/lanfeedback.js';
import lanTodoRouter from './routes/lantodo.js';
import demoParserRouter from './routes/demoParser.js';
import matchAnalyticsRouter from './routes/matchAnalytics.js';
import steamRouter from './routes/steam.js';
import config from './config/config.js';

// Validate optional configuration at startup
if (!config.STEAM_API_KEY || config.STEAM_API_KEY.trim() === '') {
  console.warn('[WARNING] STEAM_API_KEY is not configured. Steam API endpoints will fail at runtime.');
}

let app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use(function (req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept, Authorization'
  );
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

app.use('/', indexRouter);
app.use('/api/v1/lanbooking', lanbookingRouter);
app.use('/api/v1/lanregistration', lanregistrationRouter);
app.use('/api/v1/lanfeedback', lanFeedbackRouter);
app.use('/api/v1/lantodo', lanTodoRouter);
app.use('/api/v1', demoParserRouter);
// Match analytics API - cached statistical analysis
// Final URLs: /api/v1/analytics/matches/:id, /api/v1/analytics/matches/:id/mvp, etc.
app.use('/api/v1/analytics', matchAnalyticsRouter);
// Steam API - requires authentication
// Final URL: /api/steam/user/:steamId
app.use('/api/steam', steamRouter);
app.use('/api/v1/intra', requireAuth, intraRouter);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  res.status(err.status || 500);
  res.render('error');
});

const port = normalizePort(process.env.PORT || '4000');
app.set('port', port);

// Start server
const server = http.createServer(app);
server.listen(port);
server.on('error', onError);
server.on('listening', onListening);

// Normalize a port into a number, string, or false.

function normalizePort(val) {
  const portNumber = parseInt(val, 10);

  if (isNaN(portNumber)) {
    // named pipe
    return val;
  }

  if (portNumber >= 0) {
    // port number
    return portNumber;
  }

  return false;
}

// Event listener for HTTP server "error" event.

function onError(error) {
  if (error.syscall !== 'listen') {
    throw error;
  }

  const bind = typeof port === 'string' ? 'Pipe ' + port : 'Port ' + port;

  // handle specific listen errors with friendly messages
  switch (error.code) {
    case 'EACCES':
      console.error(bind + ' requires elevated privileges');
      process.exit(1);
      break;
    case 'EADDRINUSE':
      console.error(bind + ' is already in use');
      process.exit(1);
      break;
    default:
      throw error;
  }
}

// Event listener for HTTP server "listening" event.

function onListening() {
  const addr = server.address();
  const bind = typeof addr === 'string' ? 'pipe ' + addr : 'port ' + addr.port;
  debug('Listening on ' + bind);
}
