-- Add status fields to settlements
ALTER TABLE settlements ADD COLUMN status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected'));
ALTER TABLE settlements ADD COLUMN approved_at timestamptz;
ALTER TABLE settlements ADD COLUMN rejected_at timestamptz;

-- Update pair_balances view to only count 'approved' settlements
DROP VIEW IF EXISTS pair_balances;

CREATE VIEW pair_balances AS
SELECT
  least(a_id, b_id) as user_a,
  greatest(a_id, b_id) as user_b,
  sum(delta_in_paise) as net_in_paise
FROM (
  SELECT
    creator_id as a_id,
    approver_id as b_id,
    amount_in_paise as delta_in_paise
  FROM debt_requests
  WHERE status = 'approved'

  UNION ALL

  SELECT
    receiver_id as a_id,
    payer_id as b_id,
    -amount_in_paise as delta_in_paise
  FROM settlements
  WHERE status = 'approved'
) ledger
GROUP BY 1, 2;

-- Allow receiver to update settlements to approve or reject them
CREATE POLICY "receiver can update settlements"
ON settlements FOR UPDATE
TO authenticated
USING (auth.uid() = receiver_id AND status = 'pending')
WITH CHECK (auth.uid() = receiver_id);

-- Guard against tampering with settlement details during approval
CREATE OR REPLACE FUNCTION validate_settlement_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status <> 'pending' THEN
    RAISE EXCEPTION 'This settlement has already been responded to.';
  END IF;

  IF auth.uid() IS DISTINCT FROM OLD.receiver_id THEN
    RAISE EXCEPTION 'Only the receiver can respond to this settlement.';
  END IF;

  IF NEW.payer_id <> OLD.payer_id
    OR NEW.receiver_id <> OLD.receiver_id
    OR NEW.amount_in_paise <> OLD.amount_in_paise
    OR NEW.currency <> OLD.currency
    OR NEW.note IS DISTINCT FROM OLD.note
    OR NEW.settled_at <> OLD.settled_at
    OR NEW.created_at <> OLD.created_at THEN
    RAISE EXCEPTION 'Settlement details cannot be edited after creation.';
  END IF;

  IF NEW.status NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Settlements can only be approved or rejected.';
  END IF;

  IF NEW.status = 'approved' AND (NEW.approved_at IS NULL OR NEW.rejected_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Approved settlements must only set approved_at.';
  END IF;

  IF NEW.status = 'rejected' AND (NEW.rejected_at IS NULL OR NEW.approved_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Rejected settlements must only set rejected_at.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS settlement_update_guard ON settlements;

CREATE TRIGGER settlement_update_guard
BEFORE UPDATE ON settlements
FOR EACH ROW
EXECUTE FUNCTION validate_settlement_update();
