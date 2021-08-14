# Change Postgresql column type from INT to BIGINT

## Locally

## Load dataset
``` shell
# Provide in argument the number of rows to be loaded using generate_series(1, ROW_COUNT)
DATABASE_URL=postgres://postgres@localhost:5432/database npm run unreferenced-pk:load-dataset 7
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

