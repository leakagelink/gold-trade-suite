CREATE OR REPLACE FUNCTION public.admin_delete_deposit(p_deposit_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deposit public.deposit_requests%ROWTYPE;
  v_deleted_transactions integer := 0;
  v_deleted_audit_entries integer := 0;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Broker access required';
  END IF;

  SELECT * INTO v_deposit
  FROM public.deposit_requests
  WHERE id = p_deposit_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Deposit request not found';
  END IF;

  IF v_deposit.status = 'locked' THEN
    UPDATE public.user_wallets
    SET locked_balance = GREATEST(0, COALESCE(locked_balance, 0) - v_deposit.amount),
        updated_at = now()
    WHERE user_id = v_deposit.user_id
      AND currency = 'INR';
  END IF;

  DELETE FROM public.wallet_transactions
  WHERE reference_id = p_deposit_id
    AND type = 'deposit';
  GET DIAGNOSTICS v_deleted_transactions = ROW_COUNT;

  DELETE FROM public.admin_audit_log
  WHERE target_table = 'deposit_requests'
    AND target_id = p_deposit_id;
  GET DIAGNOSTICS v_deleted_audit_entries = ROW_COUNT;

  DELETE FROM public.deposit_requests
  WHERE id = p_deposit_id;

  RETURN jsonb_build_object(
    'success', true,
    'wallet_balance_changed', false,
    'locked_balance_released', v_deposit.status = 'locked',
    'deleted_transactions', v_deleted_transactions,
    'deleted_audit_entries', v_deleted_audit_entries
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_deposit(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_deposit(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_deposit(uuid) TO service_role;