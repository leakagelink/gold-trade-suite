-- Allow trusted server-side trade functions to bypass user-restriction triggers
CREATE OR REPLACE FUNCTION public.restrict_user_position_updates()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_actor uuid := auth.uid();
BEGIN
  IF v_actor IS NULL OR has_role(v_actor, 'admin'::app_role)
     OR current_setting('app.trusted_trade_op', true) = '1' THEN
    RETURN NEW;
  END IF;
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN RAISE EXCEPTION 'Cannot change position owner'; END IF;
  IF NEW.symbol IS DISTINCT FROM OLD.symbol OR NEW.position_type IS DISTINCT FROM OLD.position_type THEN
    RAISE EXCEPTION 'Cannot change symbol or position type'; END IF;
  IF NEW.status IS DISTINCT FROM OLD.status OR NEW.closed_at IS DISTINCT FROM OLD.closed_at
     OR NEW.closed_by IS DISTINCT FROM OLD.closed_by OR NEW.close_price IS DISTINCT FROM OLD.close_price THEN
    RAISE EXCEPTION 'Only Brokers can change trade status/settlement'; END IF;
  IF NEW.amount IS DISTINCT FROM OLD.amount OR NEW.entry_price IS DISTINCT FROM OLD.entry_price
     OR NEW.leverage IS DISTINCT FROM OLD.leverage OR NEW.margin IS DISTINCT FROM OLD.margin
     OR NEW.brokerage IS DISTINCT FROM OLD.brokerage OR NEW.opened_at IS DISTINCT FROM OLD.opened_at
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Cannot modify broker-controlled trade fields'; END IF;
  IF NEW.price_mode IS DISTINCT FROM OLD.price_mode THEN RAISE EXCEPTION 'Cannot change price mode'; END IF;
  IF NEW.momentum_active IS DISTINCT FROM OLD.momentum_active OR NEW.momentum_direction IS DISTINCT FROM OLD.momentum_direction
     OR NEW.momentum_target_price IS DISTINCT FROM OLD.momentum_target_price
     OR NEW.momentum_target_pnl_percent IS DISTINCT FROM OLD.momentum_target_pnl_percent
     OR NEW.edited_pnl_anchor IS DISTINCT FROM OLD.edited_pnl_anchor THEN
    RAISE EXCEPTION 'Cannot modify momentum/anchor fields'; END IF;
  IF OLD.price_mode = 'edited' AND (NEW.current_price IS DISTINCT FROM OLD.current_price OR NEW.pnl IS DISTINCT FROM OLD.pnl) THEN
    RAISE EXCEPTION 'Cannot update price/pnl on broker-edited position'; END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.restrict_user_limit_order_updates()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_actor uuid := auth.uid();
BEGIN
  IF v_actor IS NULL OR has_role(v_actor, 'admin'::app_role)
     OR current_setting('app.trusted_trade_op', true) = '1' THEN
    RETURN NEW;
  END IF;
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN RAISE EXCEPTION 'Cannot change order owner'; END IF;
  IF NEW.symbol IS DISTINCT FROM OLD.symbol OR NEW.position_type IS DISTINCT FROM OLD.position_type THEN
    RAISE EXCEPTION 'Cannot change symbol or position type'; END IF;
  IF NEW.leverage IS DISTINCT FROM OLD.leverage THEN RAISE EXCEPTION 'Cannot change leverage'; END IF;
  IF NEW.executed_at IS DISTINCT FROM OLD.executed_at THEN RAISE EXCEPTION 'Cannot change execution timestamp'; END IF;
  IF NEW.status IS DISTINCT FROM OLD.status AND NOT (OLD.status = 'pending' AND NEW.status = 'cancelled') THEN
    RAISE EXCEPTION 'Invalid status transition'; END IF;
  RETURN NEW;
END;
$function$;

-- Open (or average into) a trade and debit wallet atomically
CREATE OR REPLACE FUNCTION public.user_open_trade(
  p_symbol text, p_position_type position_type, p_quantity numeric, p_entry_price numeric,
  p_current_price numeric, p_leverage integer, p_margin numeric, p_brokerage numeric,
  p_stop_loss numeric DEFAULT NULL, p_take_profit numeric DEFAULT NULL, p_limit_order_id uuid DEFAULT NULL)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_balance numeric;
  v_total numeric;
  v_cap numeric; v_global numeric;
  v_pos positions;
  v_pos_id uuid;
  v_new_amount numeric; v_new_entry numeric; v_new_margin numeric;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_quantity IS NULL OR p_quantity <= 0 OR p_margin IS NULL OR p_margin <= 0
     OR p_entry_price IS NULL OR p_entry_price <= 0 OR p_leverage IS NULL OR p_leverage < 1 THEN
    RAISE EXCEPTION 'Invalid trade parameters'; END IF;
  IF COALESCE(p_brokerage,0) < 0 THEN RAISE EXCEPTION 'Invalid brokerage'; END IF;
  -- margin must match notional / leverage (1% tolerance)
  IF abs(p_margin - (p_quantity * p_entry_price / p_leverage)) > GREATEST(0.01, p_margin * 0.01) THEN
    RAISE EXCEPTION 'Margin does not match trade size'; END IF;

  SELECT max_leverage INTO v_cap FROM profiles WHERE id = v_uid;
  SELECT NULLIF(setting_value,'')::numeric INTO v_global FROM payment_settings WHERE setting_key = 'max_leverage';
  v_cap := COALESCE(v_cap, v_global, 100);
  IF p_leverage > v_cap THEN RAISE EXCEPTION 'Leverage exceeds permitted cap (% x)', v_cap; END IF;

  PERFORM set_config('app.trusted_trade_op', '1', true);

  IF p_limit_order_id IS NOT NULL THEN
    UPDATE limit_orders SET status = 'executed', executed_at = now(), updated_at = now()
    WHERE id = p_limit_order_id AND user_id = v_uid AND status = 'pending';
    IF NOT FOUND THEN RAISE EXCEPTION 'Limit order not pending'; END IF;
  END IF;

  v_total := p_margin + COALESCE(p_brokerage,0);
  SELECT balance INTO v_balance FROM user_wallets WHERE user_id = v_uid AND currency = 'USD' FOR UPDATE;
  IF v_balance IS NULL OR v_balance < v_total THEN
    RAISE EXCEPTION 'Insufficient balance. Required $%, available $%', round(v_total,2), round(COALESCE(v_balance,0),2);
  END IF;
  UPDATE user_wallets SET balance = balance - v_total, updated_at = now() WHERE user_id = v_uid AND currency = 'USD';

  SELECT * INTO v_pos FROM positions
  WHERE user_id = v_uid AND symbol = upper(p_symbol) AND position_type = p_position_type AND status = 'open'
  ORDER BY opened_at ASC LIMIT 1 FOR UPDATE;

  IF FOUND THEN
    v_new_amount := v_pos.amount + p_quantity;
    v_new_entry := ((v_pos.amount * v_pos.entry_price) + (p_quantity * p_entry_price)) / v_new_amount;
    v_new_margin := v_pos.margin + p_margin;
    UPDATE positions SET
      amount = v_new_amount, entry_price = v_new_entry,
      current_price = CASE WHEN price_mode = 'edited' THEN current_price ELSE COALESCE(p_current_price, p_entry_price) END,
      margin = v_new_margin,
      leverage = GREATEST(1, round((v_new_amount * v_new_entry) / v_new_margin))::int,
      stop_loss = COALESCE(p_stop_loss, stop_loss), take_profit = COALESCE(p_take_profit, take_profit),
      brokerage = COALESCE(brokerage,0) + COALESCE(p_brokerage,0), updated_at = now()
    WHERE id = v_pos.id;
    v_pos_id := v_pos.id;
  ELSE
    INSERT INTO positions (user_id, symbol, position_type, amount, entry_price, current_price, leverage, margin,
                           pnl, status, stop_loss, take_profit, brokerage)
    VALUES (v_uid, upper(p_symbol), p_position_type, p_quantity, p_entry_price, COALESCE(p_current_price, p_entry_price),
            p_leverage, p_margin, 0, 'open', p_stop_loss, p_take_profit, COALESCE(p_brokerage,0))
    RETURNING id INTO v_pos_id;
  END IF;

  INSERT INTO wallet_transactions (user_id, type, amount, currency, status, reference_id)
  VALUES (v_uid, 'trade', -p_margin, 'USD', 'Completed', v_pos_id);
  IF COALESCE(p_brokerage,0) > 0 THEN
    INSERT INTO wallet_transactions (user_id, type, amount, currency, status, reference_id)
    VALUES (v_uid, 'brokerage', p_brokerage, 'USD', 'Completed', v_pos_id);
  END IF;

  RETURN v_pos_id;
END;
$function$;

-- Close a trade and credit wallet atomically
CREATE OR REPLACE FUNCTION public.user_close_trade(
  p_position_id uuid, p_close_price numeric, p_close_brokerage numeric DEFAULT 0, p_force_loss boolean DEFAULT true)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_pos positions;
  v_close numeric; v_pnl numeric; v_final numeric; v_brk numeric;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_pos FROM positions WHERE id = p_position_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Trade not found'; END IF;
  IF v_pos.user_id <> v_uid THEN RAISE EXCEPTION 'Not your trade'; END IF;
  IF v_pos.status <> 'open' THEN
    RETURN jsonb_build_object('already_closed', true);
  END IF;

  -- Broker-edited trades always settle at the broker-controlled price
  v_close := CASE WHEN v_pos.price_mode = 'edited' THEN v_pos.current_price ELSE COALESCE(p_close_price, v_pos.current_price) END;
  IF v_close IS NULL OR v_close <= 0 THEN RAISE EXCEPTION 'Invalid close price'; END IF;

  v_pnl := CASE WHEN v_pos.position_type = 'long' THEN (v_close - v_pos.entry_price) * v_pos.amount
                ELSE (v_pos.entry_price - v_close) * v_pos.amount END;
  IF p_force_loss AND v_pnl > 0 AND v_pos.price_mode IS DISTINCT FROM 'edited' THEN
    v_pnl := -v_pnl;
    v_close := CASE WHEN v_pos.position_type = 'long' THEN v_pos.entry_price + v_pnl / v_pos.amount
                    ELSE v_pos.entry_price - v_pnl / v_pos.amount END;
  END IF;

  v_brk := GREATEST(0, COALESCE(p_close_brokerage, 0));
  v_final := v_pos.margin + v_pnl - v_brk;

  PERFORM set_config('app.trusted_trade_op', '1', true);
  UPDATE positions SET status = 'closed', closed_at = now(), close_price = v_close, current_price = v_close,
    pnl = v_pnl, closed_by = v_uid, brokerage = COALESCE(brokerage,0) + v_brk, updated_at = now()
  WHERE id = v_pos.id;

  INSERT INTO user_wallets (user_id, currency, balance) VALUES (v_uid, 'USD', GREATEST(0, v_final))
  ON CONFLICT (user_id, currency) DO UPDATE SET balance = GREATEST(0, user_wallets.balance + v_final), updated_at = now();

  INSERT INTO wallet_transactions (user_id, type, amount, currency, status, reference_id)
  VALUES (v_uid, 'trade', v_final, 'USD', 'Completed', v_pos.id);
  IF v_brk > 0 THEN
    INSERT INTO wallet_transactions (user_id, type, amount, currency, status, reference_id)
    VALUES (v_uid, 'brokerage', v_brk, 'USD', 'Completed', v_pos.id);
  END IF;

  RETURN jsonb_build_object('already_closed', false, 'close_price', v_close, 'pnl', v_pnl,
                            'brokerage', COALESCE(v_pos.brokerage,0) + v_brk, 'credited', v_final);
END;
$function$;

REVOKE ALL ON FUNCTION public.user_open_trade(text, position_type, numeric, numeric, numeric, integer, numeric, numeric, numeric, numeric, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_open_trade(text, position_type, numeric, numeric, numeric, integer, numeric, numeric, numeric, numeric, uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.user_close_trade(uuid, numeric, numeric, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_close_trade(uuid, numeric, numeric, boolean) TO authenticated;