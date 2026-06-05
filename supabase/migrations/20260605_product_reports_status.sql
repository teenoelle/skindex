-- Add status tracking and ingredient snapshot to product_reports for the
-- report → in_review → resolved admin workflow.
ALTER TABLE product_reports
  ADD COLUMN status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_review', 'resolved')),
  ADD COLUMN ingredient_snapshot jsonb,
  ADD COLUMN resolved_at timestamptz,
  ADD COLUMN resolved_by text;

CREATE INDEX ON product_reports (product_id, status);
