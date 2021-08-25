require('dotenv').config();
const {Client} = require('pg');
const _ = require('lodash');
const bunyan = require('bunyan');

const connectionString = process.env.DATABASE_URL;

const clientConfiguration = { connectionString };

const getChunkSize = (logger)=>{
  const chunkSize = parseInt(process.env.KNOWLEDGE_ELEMENTS_BIGINT_MIGRATION_CHUNK_SIZE);
  if (isNaN(chunkSize) || chunkSize <= 0) {
    logger.fatal('Environment variable "KNOWLEDGE_ELEMENTS_BIGINT_MIGRATION_CHUNK_SIZE" must be set as a positive integer');
    process.exit(1);
  }
  return chunkSize;
}

const getPauseTime = (logger)=>{
  const pauseTime = parseInt(process.env.KNOWLEDGE_ELEMENTS_BIGINT_DATA_MIGRATION_INTERVAL_MILLIS);
  if (isNaN(pauseTime) || pauseTime <= 0) {
    logger.fatal('Environment variable "KNOWLEDGE_ELEMENTS_BIGINT_DATA_MIGRATION_INTERVAL" must be set as a positive integer');
    process.exit(1);
  }
  return pauseTime;
}

const getStartId = (logger)=>{
  const START_FIRST_SERIAL_VALUE_BY_DEFAULT = 0;
  if (process.env.KNOWLEDGE_ELEMENTS_BIGINT_MIGRATION_START_ID) {
    const startId = parseInt(process.env.KNOWLEDGE_ELEMENTS_BIGINT_MIGRATION_START_ID);
    if (isNaN(startId) || startId <= 0) {
      logger.fatal('Environment variable "KNOWLEDGE_ELEMENTS_BIGINT_MIGRATION_CHUNK_SIZE" must be set as a positive integer');
      process.exit(1);
    }
    return startId;
  } else {
    return START_FIRST_SERIAL_VALUE_BY_DEFAULT;
  }
}


(async () => {

  const logger = bunyan.createLogger({name: 'prepare-bigint-id'});

  process.on('unhandledRejection', (error) => {
    logger.fatal(error);
  });

  const chunkSize = getChunkSize(logger);

  const pauseTime = getPauseTime(logger);

  const client = new Client(clientConfiguration);

  client.query = _.wrap(client.query, async function (func, query) {
    console.time(`\t${query}`);
    const result = await func.call(this, query);
    console.timeEnd(`\t${query}`);
    return result;
  });

  client.connect();

  let rowsUpdatedCount = 0;
  const maxData = await client.query('SELECT MAX(id) FROM "knowledge-elements"');
  const endId = maxData.rows[0].max;

  const startId = getStartId();

  logger.info(`Migrating data between ids ${startId} and ${endId}`);

  for (let id = startId; id < endId; id += chunkSize) {
    const result = await client.query(`
        UPDATE "knowledge-elements"
        SET "bigintId" = id
        WHERE ID BETWEEN ${id} AND ${id + chunkSize - 1}`);

    rowsUpdatedCount = result.rowCount;
    logger.info(`Updated rows : ${rowsUpdatedCount}`);

    await new Promise(resolve => {
      setTimeout(resolve, pauseTime)
    })
  }

  logger.info('Building index concurrently..');
  await client.query('CREATE UNIQUE INDEX CONCURRENTLY "knowledge-elements_bigintId_index" ON "knowledge-elements"("bigintId")');
  logger.info('Done');

  client.end();

  process.exit(0);
})();
