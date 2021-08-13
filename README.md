# INT to BIGINT

## Load dataset
``` shell
scalingo -region osc-fr1 -a pix-int-to-bigint-test run bash
dbclient-fetcher pgsql
psql -f create-schema-unreferenced-pk.sql
```
