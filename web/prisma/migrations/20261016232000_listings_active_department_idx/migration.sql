-- City filter requests group active listings by department on every city.
-- Without this index Postgres seq-scans the whole listings table (~6s cold).

CREATE INDEX IF NOT EXISTS listings_active_department_idx
  ON listings (department)
  WHERE is_active = true;
