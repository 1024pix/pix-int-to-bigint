require('dotenv').config();
const {Client} = require('pg');
const _ = require('lodash');
const bunyan = require('bunyan');
const migrateRows = require('./migrate-rows-concurrently');

const MAX_INTEGER = 2147483627;
const idThatWouldBeRejectedWithInteger = MAX_INTEGER + 1;

const connectionString = process.env.DATABASE_URL;

const poolConfiguration = {
  connectionString
};

const million = 1000000;
const CHUNK_SIZE = million;

const changes = [
  {
    label: 'CHANGE_UNREFERENCED_PK_WITH_TEMPORARY_COLUMN',
    perform: async (client, logger) => {

      logger.info('Preparing for maintenance window:');
      await client.query('ALTER TABLE foo ADD COLUMN new_id BIGINT NOT NULL DEFAULT -1');
      logger.info('- new_id column has been created');

      // Feed new_id for each new inserted row
      await client.query(`CREATE OR REPLACE FUNCTION migrate_id_concurrently()
                          RETURNS TRIGGER AS
                          $$
                          BEGIN
                              NEW.new_id = NEW.id::BIGINT;
                              RETURN NEW;
                          END
                          $$ LANGUAGE plpgsql;`);

      await client.query(`CREATE TRIGGER trg_foo
                          BEFORE INSERT ON foo
                          FOR EACH ROW
                          EXECUTE PROCEDURE migrate_id_concurrently();`);

      logger.info('- trigger has been created, so that each new record in table will have new_id filled');

      // Feed new_id for each existing row
      logger.info(`- feeding new_id on existing rows (using ${CHUNK_SIZE}-record size chunks)`);

      await migrateRows.migrateFooId(client, CHUNK_SIZE, logger);
      logger.info(`- finished feeding new_id on existing rows`);

      // Prepare Primary key unique constraint
      // https://www.2ndquadrant.com/en/blog/create-index-concurrently/
      // https://dba.stackexchange.com/questions/131945/detect-when-a-create-index-concurrently-is-finished-in-postgresql
      logger.info('- starting building index concurrently on new_id');
      await client.query('CREATE UNIQUE INDEX CONCURRENTLY idx ON foo(new_id)');
      logger.info('- index on new_id has been build concurrently');

      ////////// MAINTENANCE WINDOW STARTS HERE ////////////////////////////////
      logger.info('Opening maintenance window...');
      console.time('Maintenance duration');

      logger.info('Put a lock on table "foo"');
      await client.query('BEGIN TRANSACTION;');
      await client.query('LOCK TABLE foo IN ACCESS EXCLUSIVE MODE;');// Disable migration
      await client.query('DROP TRIGGER trg_foo ON foo');
      await client.query('DROP FUNCTION migrate_id_concurrently');
      logger.info('- triggers have been dropped');

      // https://stackoverflow.com/questions/9490014/adding-serial-to-existing-column-in-postgres
      logger.info('- turning sequence ownership to new_id');
      await client.query('ALTER SEQUENCE foo_id_seq OWNED BY foo.new_id');
      logger.info('- sequence ownership has been turned to new_id');

      logger.info('- changing sequence type to BIGINT');
      await client.query('ALTER SEQUENCE foo_id_seq AS BIGINT');
      logger.info('- sequence type is now BIGINT');

      logger.info('- attaching sequence to new_id');
      await client.query(`ALTER TABLE foo ALTER COLUMN new_id SET DEFAULT nextval('foo_id_seq')`);
      logger.info('- sequence has attached to new_id');

      logger.info('- detaching sequence from id');
      await client.query('ALTER TABLE foo ALTER COLUMN id DROP DEFAULT');
      logger.info('- sequence is now used by new_id');

      logger.info('- dropping primary key on id');
      await client.query('ALTER TABLE foo DROP CONSTRAINT foo_pkey');
      // Enable PK on new_id before dropping id, in case something is wrong
      logger.info('- primary key on id has been dropped');

      logger.info('- creating primary key on new_id using existing index');
      await client.query('ALTER TABLE foo ADD CONSTRAINT foo_pkey PRIMARY KEY USING INDEX idx');
      logger.info('- primary key on new_id has been created');

      logger.info('- dropping column id');
      await client.query('ALTER TABLE foo DROP COLUMN id');
      logger.info('- column id has been dropped');

      await client.query('ALTER TABLE foo RENAME COLUMN new_id TO id');
      logger.info('- column new_id has been renamed to id');

      await client.query(`INSERT INTO foo(id) VALUES (${idThatWouldBeRejectedWithInteger})`);
      logger.info(`- INSERT has succeeded with id ${idThatWouldBeRejectedWithInteger}`);

      await client.query('COMMIT;');
      console.timeEnd('Maintenance duration');
      logger.info('Closing maintenance window...');

      ////////// MAINTENANCE WINDOW STOPS HERE ////////////////////////////////

    },
    revert: async (client, logger) => {
      await client.query(
        `DELETE FROM foo WHERE id = ${idThatWouldBeRejectedWithInteger}`
      );
      await client.query('ALTER TABLE foo DROP CONSTRAINT foo_pkey');
      await client.query('ALTER SEQUENCE foo_id_seq AS INTEGER');
      await client.query('ALTER TABLE foo ALTER COLUMN id TYPE INTEGER');
      await client.query(
        'ALTER TABLE foo ADD CONSTRAINT foo_pkey PRIMARY KEY(id)'
      );
    },
  },
  {
    label: 'CHANGE_UNREFERENCED_PK_IN_PLACE',
    perform: async (client, logger) => {

      ////////// MAINTENANCE WINDOW STARTS HERE ////////////////////////////////
      logger.info('Opening maintenance window...');
      console.time('Maintenance duration');

      logger.info('- changing id column type to BIGINT');
      await client.query('ALTER TABLE foo ALTER COLUMN id TYPE BIGINT;');
      logger.info('- column foo.id has been changed to type BIGINT');

      logger.info('- changing sequence type to BIGINT');
      await client.query('ALTER SEQUENCE foo_id_seq AS BIGINT');
      logger.info('- sequence for foo.id table has been changed to type BIGINT');

      logger.info('- inserting row with id ${idThatWouldBeRejectedWithInteger}');
      await client.query(`INSERT INTO foo(id)  VALUES (${idThatWouldBeRejectedWithInteger})`);
      logger.info(`- INSERT has succeeded with id ${idThatWouldBeRejectedWithInteger}`);

      logger.info('Closing maintenance window...');
      console.timeEnd('Maintenance duration');

      ////////// MAINTENANCE WINDOW STOPS HERE ////////////////////////////////

    },
    revert: async (client, logger) => {
      await client.query(`DELETE FROM foo WHERE id = ${idThatWouldBeRejectedWithInteger}`);
      await client.query('ALTER TABLE foo DROP CONSTRAINT foo_pkey');
      await client.query('ALTER SEQUENCE foo_id_seq AS INTEGER');
      await client.query('ALTER TABLE foo ALTER COLUMN id TYPE INTEGER');
      await client.query('ALTER TABLE foo ADD CONSTRAINT foo_pkey PRIMARY KEY(id)'
      );
    },
  },
];

(async () => {

  const logger = bunyan.createLogger({name: 'pix_bigint'});

  process.on('unhandledRejection', (error) => {
    logger.fatal(error);
  });

  const client = new Client(poolConfiguration);

  client.query = _.wrap(client.query, async function (func, query) {
    console.time(`\t${query}`);
    const result = await func.call(this, query);
    console.timeEnd(`\t${query}`);
    return result;
  });

  client.connect();

  for (const change of changes) {

    logger.info(`👷 Changing type with ${change.label} 🕗`);
    await change.perform(client, logger);
    logger.info(`Type changed ✔`);

    logger.info('Reverting 🕗');
    await change.revert(client, logger);
    logger.info(`Reverted ✔`);

  }

  client.end();

  process.exit(0);
})();
