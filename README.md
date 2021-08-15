# Change Postgresql column type from INT to BIGINT

## Locally

## Load dataset

### Using series
``` shell
# Provide in argument the number of rows to be loaded using generate_series(1, ROW_COUNT)
DATABASE_URL=postgres://postgres@localhost:5432/database npm run unreferenced-pk:load-dataset 7
```

### By copy
Create table structure on database with no constraints. 

``` shell
SOURCE_DATABASE_URL=postgres://postgres@localhost:5432/source_database DATABASE_URL=postgres://postgres@localhost:5432/target_database TABLE_TO_COPY=foo node ./unreferenced-pk/copy-dataset.js
```

### Perform change

``` shell
npm run unreferenced-pk:change-type
DATABASE_URL=postgres://postgres@localhost:5432/database npm run unreferenced-pk:change-type
```

## Remotely

Scalingo one-off containers are attached by default, which involve a 45-minute timeout (see message below).

``` bash
/!\  Connection timed out due to inactivity, one-off aborted.
Data should be sent to/from the container regularly to avoid such timeout
If you need to run long background tasks, the '--detached' should be used
```

To get around, run the container as [detached](https://doc.scalingo.com/platform/app/tasks#run-a-detached-one-off)

### Load dataset

### Using series
Attached

``` shell
scalingo --region osc-fr1 --app pix-int-to-bigint-test run bash
# Provide in argument the number of rows to be loaded using generate_series(1, ROW_COUNT)
npm run unreferenced-pk:load-dataset 7
```

Detached 

``` shell
# Provide in argument the number of rows to be loaded using generate_series(1, ROW_COUNT)
scalingo --region osc-fr1 --app pix-int-to-bigint-test run --detached npm run unreferenced-pk:load-dataset 7
```

### By copy

Create table structure on database with no constraints.

Configure
```bash
SOURCE_DATABASE_URL= 
DATABASE_URL=
TABLE_TO_COPY=
```

Run
``` shell
scalingo --region osc-fr1 --app pix-int-to-bigint-test run bash
npm run unreferenced-pk:copy-dataset
```

### Perform change

Attached

``` shell
scalingo -region osc-fr1 -a pix-int-to-bigint-test run bash
npm run unreferenced-pk:change-type
```

Detached

``` shell
scalingo --region osc-fr1 --app pix-int-to-bigint-test run --detached npm run unreferenced-pk:change-type
```

Sample output
``` bash
2021-08-14 17:47:28.623084849 +0200 CEST [manager] container [one-off-1166] (6117e58a6ffbd94ed788bf94) started with the command 'npm run unreferenced-pk:change-type'
2021-08-14 17:47:28.892708334 +0200 CEST [one-off-1166]
2021-08-14 17:47:28.892747419 +0200 CEST [one-off-1166] > node ./unreferenced-pk/change-type.js
2021-08-14 17:47:28.892745486 +0200 CEST [one-off-1166] > pix-int-to-bigint@1.0.0 unreferenced-pk:change-type /app
2021-08-14 17:47:28.892748324 +0200 CEST [one-off-1166]
2021-08-14 17:47:28.997434847 +0200 CEST [one-off-1166] - new_id column has ben created
2021-08-14 17:47:28.966304186 +0200 CEST [one-off-1166] Preparing for maintenance window:
2021-08-14 17:47:28.966068803 +0200 CEST [one-off-1166] 👷 Changing type with CHANGE_UNREFERENCED_PK_WITH_TEMPORARY_COLUMN 🕗
2021-08-14 17:47:29.004664283 +0200 CEST [one-off-1166] - starting building index concurrently on new_id
2021-08-14 17:47:29.004648370 +0200 CEST [one-off-1166] - trigger has been created, so that each new record in table will have new_id filled
2021-08-14 19:03:19.934592738 +0200 CEST [one-off-1166] - feeding new_id on existing rows (using 1000000-record size chunks)
2021-08-14 19:03:19.934577892 +0200 CEST [one-off-1166] - index on new_id has been build concurrently
2021-08-15 03:24:18.147471372 +0200 CEST [one-off-1166] Opening maintenance window...
2021-08-15 03:24:19.254240053 +0200 CEST [one-off-1166] - triggers have been dropped
2021-08-15 04:26:47.188351720 +0200 CEST [one-off-1166] - sequence type is now BIGINT
2021-08-15 04:26:47.147809313 +0200 CEST [one-off-1166] - 0 remaining rows on foo have been migrated
2021-08-15 04:26:48.210707576 +0200 CEST [one-off-1166] - sequence is now used by new_id
2021-08-15 04:26:49.249146584 +0200 CEST [one-off-1166] - primary key on id has been dropped
2021-08-15 04:59:25.074369235 +0200 CEST [one-off-1166] - primary key on new_id has been created
2021-08-15 04:59:25.078622722 +0200 CEST [one-off-1166] - column id has been dropped
2021-08-15 04:59:25.080163797 +0200 CEST [one-off-1166] - column new_id has been renamed to id
2021-08-15 04:59:25.085200293 +0200 CEST [one-off-1166] - INSERT has succeeded with id 2147483628
2021-08-15 04:59:25.085205864 +0200 CEST [one-off-1166] Closing maintenance window...
2021-08-15 04:59:25.085230207 +0200 CEST [one-off-1166] Type changed ✔
2021-08-15 04:59:25.085233973 +0200 CEST [one-off-1166] Reverting 🕗
2021-08-15 07:52:32.375249799 +0200 CEST [one-off-1166] Reverted ✔
2021-08-15 07:52:32.375255560 +0200 CEST [one-off-1166] 👷 Changing type with CHANGE_UNREFERENCED_PK_IN_PLACE 🕗
2021-08-15 07:52:32.375532211 +0200 CEST [one-off-1166] Opening maintenance window...
2021-08-15 09:58:49.209288381 +0200 CEST [one-off-1166] - column foo.id has been changed to type BIGINT
2021-08-15 09:58:49.223369625 +0200 CEST [one-off-1166] - sequence for foo.id table has been changed to type BIGINT
2021-08-15 09:58:49.225897691 +0200 CEST [one-off-1166] - INSERT has succeeded with id 2147483628
2021-08-15 09:58:49.225901760 +0200 CEST [one-off-1166] Closing maintenance window...
2021-08-15 09:58:49.225903278 +0200 CEST [one-off-1166] Type changed ✔
2021-08-15 09:58:49.226003336 +0200 CEST [one-off-1166] Reverting 🕗
2021-08-15 13:11:18.584337424 +0200 CEST [one-off-1166] Reverted ✔

```

