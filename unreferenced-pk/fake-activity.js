require('dotenv').config();
const bunyan = require('bunyan');
const logger = bunyan.createLogger({name: 'pix_bigint'});
const {Client} = require('pg');

const agent = async (query, interval) => {
  const connectionString = process.env.DATABASE_URL;
  const client = new Client(connectionString);
  await client.connect();

  while (true) {
    try {
      await client.query(query);
    } catch (error) {
      logger.error(error);
    }
    await new Promise((resolve) => {
      setTimeout(resolve, interval);
    });

  }

}

const launchAgents = async () => {

  const queries = JSON.parse(process.env.QUERIES);

  const agents = queries.flatMap((query) => {
    let promises = [];
    for (let i = 0; i < query.agentCount; i++) {
      promises.push(agent(query.text, query.interval));
    }
    return promises
  });

  await Promise.all(agents);
}

(async () => {
  try {
    await launchAgents();
  } catch (error) {
    logger.error(error);
  }
})()
