require('dotenv').config();
const {Client} = require('pg');
const _ = require('lodash');
const bunyan = require('bunyan');

const connectionString = process.env.DATABASE_URL;

const clientConfiguration = { connectionString };

const million = 1000000;
const CHUNK_SIZE = million;

(async () => {

  const logger = bunyan.createLogger({name: 'prepare'});

  process.on('unhandledRejection', (error) => {
    logger.fatal(error);
  });

  const client = new Client(clientConfiguration);

  client.query = _.wrap(client.query, async function (func, query) {
    console.time(`\t${query}`);
    const result = await func.call(this, query);
    console.timeEnd(`\t${query}`);
    return result;
  });

  client.connect();

  let rowsUpdatedCount = 0;
  const data = await client.query('SELECT MAX(id) FROM "knowledge-elements"');
  const maxId = data.rows[0].max;

  for (let startId = 0; startId < maxId; startId += CHUNK_SIZE) {
    const result = await client.query(`
        UPDATE "knowledge-elements"
        SET "bigintId" = id
        WHERE ID BETWEEN ${startId} AND ${startId + CHUNK_SIZE}`);

    rowsUpdatedCount = result.rowCount;
    logger.info(`Updated rows : ${rowsUpdatedCount}`);
  }

  logger.info('Building index concurrently..');
  await client.query('CREATE UNIQUE INDEX CONCURRENTLY "knowledge-elements_bigintId_index" ON "knowledge-elements"("bigintId")');
  logger.info('Done');

  client.end();

  process.exit(0);
})();
