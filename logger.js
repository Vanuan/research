var logger = exports;
logger.debugLevel = 'WARN';
logger.ERROR = 'ERROR';
logger.WARN = 'WARN';
logger.INFO = 'INFO';
logger.DEBUG = 'DEBUG';

logger.log = function(level, message) {
  var levels = [logger.ERROR, logger.WARN, logger.INFO, logger.DEBUG];
  if (levels.indexOf(level) <= levels.indexOf(logger.debugLevel) ) {
    if (typeof message !== 'string') {
      message = JSON.stringify(message);
    };
    console.log('['+level+'] '+message);
  }
};
logger.debug = function (message)  {
  logger.log(logger.DEBUG, message);
};
logger.info = function (message)  {
  logger.log(logger.INFO, message);
};
logger.warn = function (message)  {
  logger.log(logger.WARN, message);
};
logger.error = function (message)  {
  logger.log(logger.ERROR, message);
};
