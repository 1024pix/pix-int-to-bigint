--------- Handle table dependencies -----------
DROP TABLE IF EXISTS foo;

--------- Loading data -----------
CREATE TABLE foo (
  id    INTEGER
);

---- Insert some data
INSERT INTO foo(id)
SELECT *
FROM
  generate_series( 1, 70000000) -- 70 million => 2 minutes
--    generate_series( 1, 700000000) -- 700 million => 20 minutes
;

ALTER TABLE foo
ADD CONSTRAINT foo_pkey PRIMARY KEY;

DROP SEQUENCE IF EXISTS foo_id_seq;
CREATE SEQUENCE foo_id_seq AS INTEGER START 70000001;
ALTER TABLE foo ALTER COLUMN id SET DEFAULT nextval('foo_id_seq');
