CREATE EXTENSION pg_stat_statements;
CREATE EXTENSION pg_buffercache;

----------
-- User  -
----------
CREATE USER activity;

----------
-- Privileges  -
----------
GRANT CONNECT ON DATABASE database TO activity;

----------
-- Views  -
----------

-- https://www.postgresql.org/docs/13/pgstatstatements.html#PGSTATSTATEMENTS-COLUMNS
CREATE VIEW cumulated_statistics AS
SELECT
    TRUNC(SUM(stt.total_time))                  execution_time_ms
   ,pg_size_pretty(SUM(temp_blks_written) * 8192)    disk_temp_size
FROM pg_stat_statements stt
    INNER JOIN pg_authid usr ON usr.oid = stt.userid
    INNER JOIN pg_database db ON db.oid = stt.dbid
WHERE db.datname = 'database'
;
