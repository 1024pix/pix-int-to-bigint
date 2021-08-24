require('dotenv').config();
const {Pool} = require('pg');

const execute = async () => {

  const connectionString = process.env.DATABASE_URL;

  const poolConfiguration = {
    connectionString
  }

  const client = new Pool(poolConfiguration);

  client.connect();

  const ROW_COUNT = parseInt(process.argv[2]);

  if (isNaN(ROW_COUNT) || ROW_COUNT <= 0) {
    console.error(`ROW_COUNT should be positive, but was given ${ROW_COUNT}`);
    process.exit(1);
  }
  console.log(`Create table foo with ${ROW_COUNT} rows...`);

  console.log(`Drop table if exists...`);
  await client.query(`DROP TABLE IF EXISTS foo`);
  await client.query(`CREATE TABLE foo (id INTEGER)`);

  console.log(`Insert data...`);
  await client.query(`INSERT INTO foo(id) SELECT * FROM generate_series( 1, ${ROW_COUNT} )`);

  console.log(`Create primary key...`);
  await client.query(`ALTER TABLE foo ADD CONSTRAINT foo_pkey PRIMARY KEY (id)`);

  console.log(`Create and link INTEGER sequence ...`);
  await client.query(`DROP SEQUENCE IF EXISTS foo_id_seq`);
  await client.query(`CREATE SEQUENCE foo_id_seq AS INTEGER START ${ROW_COUNT + 1}`);
  await client.query(`ALTER TABLE foo ALTER COLUMN id SET DEFAULT nextval('foo_id_seq')`);

  console.log(`Done.`);

  client.end();
  process.exit(0);

}

(async () => {
  await execute();
})()


