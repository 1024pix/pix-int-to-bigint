// https://blog.pilosus.org/posts/2019/12/07/postgresql-update-rows-in-chunks/
const migrateFooId = async (client, chunk_size) => {
  let rowsUpdatedCount = 0;

  do {
    const result = await client.query(`WITH rows AS (
          SELECT id
          FROM foo
          WHERE new_id = -1
          LIMIT ${chunk_size}
        )
        UPDATE foo
        SET new_id = id
        WHERE EXISTS (SELECT * FROM rows WHERE foo.id = rows.id)`);

    rowsUpdatedCount = result.rowCount;
  } while (rowsUpdatedCount >= chunk_size);
};

module.exports = { migrateFooId };
