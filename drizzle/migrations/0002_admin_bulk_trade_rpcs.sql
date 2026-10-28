CREATE OR REPLACE FUNCTION public.admin_open_trade(p_user_id uuid, p_symbol text, p_position_type position_type, p_margin numeric, p_leverage integer, p_price numeric, p_price_mode text DEFAULT 'live')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_bal numeric; v_id uuid; v_amount numeric;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN RAISE EXCEPTION 'Only Brokers can open bulk trades'; END IF;
  IF p_margin IS NULL OR p_margin <= 0 OR p_price IS NULL OR p_price <= 0 OR p_leverage < 1 THEN RAISE EXCEPTION 'Invalid trade values'; END IF;
  SELECT balance INTO v_bal FROM user_wallets WHERE user_id = p_user_id AND currency = 'USD' FOR UPDATE;
  IF COALESCE(v_bal,0) < p_margin THEN RAISE EXCEPTION 'Insufficient balance (available $%)', round(COALESCE(v_bal,0),2); END IF;
  UPDATE user_wallets SET balance = balance - p_margin, updated_at = now() WHERE user_id = p_user_id AND currency = 'USD';
  v_amount := (p_margin * p_leverage) / p_price;
  INSERT INTO positions (user_id, symbol, position_type, amount, entry_price, current_price, leverage, margin, status, price_mode)
  VALUES (p_user_id, upper(p_symbol), p_position_type, v_amount, p_price, p_price, p_leverage, p_margin, 'open', CASE WHEN p_price_mode IN ('live','manual') THEN p_price_mode ELSE 'live' END)
  RETURNING id INTO v_id;
  INSERT INTO wallet_transactions (user_id, type, amount, currency, status, reference_id) VALUES (p_user_id, 'trade', -p_margin, 'USD', 'Completed', v_id);
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.admin_cancel_trade(p_position_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_pos positions%ROWTYPE;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN RAISE EXCEPTION 'Only Brokers can delete trades'; END IF;
  SELECT * INTO v_pos FROM positions WHERE id = p_position_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Trade not found'; END IF;
  IF v_pos.status = 'open' THEN
    UPDATE user_wallets SET balance = balance + v_pos.margin, updated_at = now() WHERE user_id = v_pos.user_id AND currency = 'USD';
    INSERT INTO wallet_transactions (user_id, type, amount, currency, status, reference_id) VALUES (v_pos.user_id, 'trade', v_pos.margin, 'USD', 'Completed', NULL);
  END IF;
  DELETE FROM position_audit_log WHERE position_id = p_position_id;
  DELETE FROM positions WHERE id = p_position_id;
END $$;

REVOKE EXECUTE ON FUNCTION public.admin_open_trade(uuid,text,position_type,numeric,integer,numeric,text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_cancel_trade(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_open_trade(uuid,text,position_type,numeric,integer,numeric,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_cancel_trade(uuid) TO authenticated;