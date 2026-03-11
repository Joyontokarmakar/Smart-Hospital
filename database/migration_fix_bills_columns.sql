-- Migration to ensure bills table has amount_paid and amount_due columns
ALTER TABLE bills ADD COLUMN IF NOT EXISTS amount_paid DECIMAL(10, 2) NOT NULL DEFAULT 0.00;
ALTER TABLE bills ADD COLUMN IF NOT EXISTS amount_due DECIMAL(10, 2) NOT NULL DEFAULT 0.00;
