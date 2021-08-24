const makeEta = require('simple-eta');

const migrateFooId = async (client, chunk_size, logger) => {

    let rowsUpdatedCount = 0;
    const {rows: [{max: maxId}]} = await client.query(`SELECT MAX(id) FROM foo`);

    const eta = makeEta({min: 0, max: maxId, historyTimeConstant: 60});
    let processedRows = 0;

    for (let startId = 0; startId < maxId; startId += chunk_size) {
      const result = await client.query(`
        UPDATE foo
        SET new_id = id
        WHERE ID BETWEEN ${startId} AND ${startId + chunk_size}`);

      rowsUpdatedCount = result.rowCount;
      logger.info(`Updated rows : ${rowsUpdatedCount}`);
      processedRows += rowsUpdatedCount;
      eta.report(processedRows);
      logger.info(`Approximately ${Math.trunc(eta.estimate())} seconds left`);
    }
  }
;

module.exports = {migrateFooId};
