const { Pool } = require('pg');

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
      perform: async (client) => {

         console.log('Preparing for maintenance window:');

         await client.query('ALTER TABLE foo ADD COLUMN new_id BIGINT');
         console.log('- new_id column has ben created');

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

         console.log(
            '- trigger has been created, so that each new record in table will have new_id filled'
         );

         // Prepare Primary key unique constraint
         // https://www.2ndquadrant.com/en/blog/create-index-concurrently/
         // https://dba.stackexchange.com/questions/131945/detect-when-a-create-index-concurrently-is-finished-in-postgresql
         console.log('- starting building index concurrently on new_id');
         await client.query('CREATE UNIQUE INDEX CONCURRENTLY idx ON foo(new_id)');
         console.log('- index on new_id has been build concurrently');

         // Feed new_id for each existing row
         console.log(
            `- feeding new_id on existing rows (using ${CHUNK_SIZE}-record size chunks)`
         );

         await migrateRows.migrateFooId(client, CHUNK_SIZE);
         console.log(`- finished feeding new_id on existing rows`);

         ////////// MAINTENANCE WINDOW STARTS HERE ////////////////////////////////
         console.log('Opening maintenance window...');

         // Disable migration
         await client.query('DROP TRIGGER trg_foo ON foo');
         await client.query('DROP FUNCTION migrate_id_concurrently');
         console.log('- triggers have been dropped');

         // Migrate remaining rows
         const resultFoo = await client.query(`
        UPDATE foo
        SET new_id = id
        WHERE new_id IS NULL`);

         console.log(
            `- ${resultFoo.rowCount} remaining rows on foo have been migrated`
         );

         // https://stackoverflow.com/questions/9490014/adding-serial-to-existing-column-in-postgres
         await client.query('ALTER SEQUENCE foo_id_seq OWNED BY foo.new_id');
         await client.query('ALTER SEQUENCE foo_id_seq AS BIGINT');
         console.log('- sequence type is now BIGINT');

         await client.query(
            `ALTER TABLE foo ALTER COLUMN new_id SET DEFAULT nextval('foo_id_seq')`
         );
         await client.query('ALTER TABLE foo ALTER COLUMN id DROP DEFAULT');
         console.log('- sequence is now used by new_id');

         await client.query('ALTER TABLE foo DROP CONSTRAINT foo_pkey');
         // Enable PK on new_id before dropping id, in case something is wrong
         console.log('- primary key on id has been dropped');

         await client.query(
            'ALTER TABLE foo ADD CONSTRAINT foo_pkey PRIMARY KEY USING INDEX idx'
         );
         console.log('- primary key on new_id has been created');

         await client.query('ALTER TABLE foo DROP COLUMN id');
         console.log('- column id has been dropped');

         await client.query('ALTER TABLE foo RENAME COLUMN new_id TO id');
         console.log('- column new_id has been renamed to id');

         await client.query(
            `INSERT INTO foo(id) VALUES (${idThatWouldBeRejectedWithInteger})`
         );

         console.log(
            `- INSERT has succeeded with id ${idThatWouldBeRejectedWithInteger}`
         );

         console.log('Closing maintenance window...');

         ////////// MAINTENANCE WINDOW STOPS HERE ////////////////////////////////

      },
      revert: async (client) => {
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
      perform: async (client) => {

         ////////// MAINTENANCE WINDOW STARTS HERE ////////////////////////////////
         console.log('Opening maintenance window...');

         await client.query('ALTER TABLE foo ALTER COLUMN id TYPE BIGINT;');
         console.log('- column foo.id has been changed to type BIGINT');

         await client.query('ALTER SEQUENCE foo_id_seq AS BIGINT');
         console.log(
            '- sequence for foo.id table has been changed to type BIGINT'
         );

         await client.query(
            `INSERT INTO foo(id)  VALUES (${idThatWouldBeRejectedWithInteger})`
         );
         console.log(
            `- INSERT has succeeded with id ${idThatWouldBeRejectedWithInteger}`
         );

         console.log('Closing maintenance window...');

         ////////// MAINTENANCE WINDOW STOPS HERE ////////////////////////////////

      },
      revert: async (client) => {
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
];

(async () => {

   const client = new Pool(poolConfiguration);

   client.connect();

   for (const change of changes) {

      console.log(`👷 Changing type with ${change.label} 🕗`);
      await change.perform(client);
      console.log(`Type changed ✔`);

      console.log('Reverting 🕗');
      await change.revert(client);
      console.log(`Reverted ✔`);

   }

   client.end();

   process.exit(0);
})();
