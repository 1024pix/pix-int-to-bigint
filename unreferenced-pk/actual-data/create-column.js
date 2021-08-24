require('dotenv').config();
const {Client} = require('pg');
const _ = require('lodash');
const bunyan = require('bunyan');

const connectionString = process.env.DATABASE_URL;
const FAKE_VALUE_TO_COMPLY_WITH_NOT_NULL_CONSTRAINT_MANDATORY_FOR_FUTURE_PK = -1;

const clientConfiguration = {
  connectionString
};

(async () => {

  const logger = bunyan.createLogger({name: 'pix_bigint'});

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

  await client.query(`ALTER TABLE "knowledge-elements" ADD COLUMN "bigintId" BIGINT NOT NULL DEFAULT ${FAKE_VALUE_TO_COMPLY_WITH_NOT_NULL_CONSTRAINT_MANDATORY_FOR_FUTURE_PK}`);

  await  client.query(`CREATE OR REPLACE FUNCTION copy_int_id_to_bigint_id()
  RETURNS TRIGGER AS
  $$
  BEGIN
    NEW."bigintId" = NEW.id::BIGINT;
    RETURN NEW;
  END
  $$ LANGUAGE plpgsql;`);

  await  client.query(`CREATE TRIGGER "trg_knowledge-elements"
  BEFORE INSERT ON "knowledge-elements"
  FOR EACH ROW
  EXECUTE FUNCTION copy_int_id_to_bigint_id();`);

  client.end();

  process.exit(0);
})();
