require('dotenv').config();
const bunyan = require('bunyan');
const logger = bunyan.createLogger({
  name: 'fake-activity',
  level: process.env.LOG_LEVEL || 'INFO',
});
const {Client} = require('pg');

const agent = async (query, interval) => {
  const connectionString = process.env.DATABASE_URL;
  const client = new Client(connectionString);
  await client.connect();

  while (true) {
    try {
      logger.debug(`Submitting ${query}...`);
      await client.query(query);
      logger.debug(`${query} has been executed`);
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
