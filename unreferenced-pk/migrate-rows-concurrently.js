// https://blog.pilosus.org/posts/2019/12/07/postgresql-update-rows-in-chunks/
const migrateFooId = async (client, chunk_size, logger) => {
  let rowsUpdatedCount = 0;
  const { rows: [ { max: maxId } ] } = await client.query(`SELECT MAX(id) FROM foo`);

  for(let startId = 0; startId < maxId; startId+=chunk_size) {
    const result = await client.query(`
        UPDATE foo
        SET new_id = id
        WHERE ID BETWEEN ${startId} AND ${startId+chunk_size}`);
    rowsUpdatedCount = result.rowCount;
    logger.info(`Updated rows : ${rowsUpdatedCount}`);
  }
};

module.exports = { migrateFooId };
