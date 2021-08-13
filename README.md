# INT to BIGINT

## Load dataset
``` shell
scalingo -region osc-fr1 -a pix-int-to-bigint-test run bash
# Provide in argument the number of rows to be loaded using generate_series(1, ROW_COUNT)
npm run create-unreferenced-pk 7
```
