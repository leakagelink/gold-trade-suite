CREATE OR REPLACE FUNCTION public.approve_deposit(deposit_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_deposit RECORD;
  v_exchange_rate NUMERIC := 0.012;
  v_bonus_enabled BOOLEAN := false;
  v_bonus_percentage NUMERIC := 0;
  v_min_amount NUMERIC := 0;
  v_max_amount NUMERIC := NULL;
  v_bonus_max NUMERIC := NULL;
  v_usd_amount NUMERIC;
  v_bonus_amount NUMERIC := 0;
  v_total_amount NUMERIC;
  v_setting_value TEXT;
  v_user_offer RECORD;
  v_offer_found BOOLEAN := false;
  v_user_bonus NUMERIC := 0;
BEGIN
  SELECT * INTO v_deposit FROM deposit_requests WHERE id = deposit_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Deposit request not found'; END IF;
  IF v_deposit.status NOT IN ('pending', 'locked') THEN
    RAISE EXCEPTION 'Deposit request is not pending or locked';
  END IF;

  SELECT setting_value INTO v_setting_value FROM payment_settings WHERE setting_key = 'exchange_rate';
  IF COALESCE(v_setting_value,'') <> '' THEN v_exchange_rate := v_setting_value::NUMERIC; END IF;
  v_setting_value := NULL;
  SELECT setting_value INTO v_setting_value FROM payment_settings WHERE setting_key = 'deposit_bonus_enabled';
  IF v_setting_value = 'true' THEN v_bonus_enabled := true; END IF;
  v_setting_value := NULL;
  SELECT setting_value INTO v_setting_value FROM payment_settings WHERE setting_key = 'deposit_bonus_percentage';
  IF COALESCE(v_setting_value,'') <> '' THEN v_bonus_percentage := v_setting_value::NUMERIC; END IF;
  v_setting_value := NULL;
  SELECT setting_value INTO v_setting_value FROM payment_settings WHERE setting_key = 'deposit_min_amount';
  IF COALESCE(v_setting_value,'') <> '' THEN v_min_amount := v_setting_value::NUMERIC; END IF;
  v_setting_value := NULL;
  SELECT setting_value INTO v_setting_value FROM payment_settings WHERE setting_key = 'deposit_max_amount';
  IF COALESCE(v_setting_value,'') <> '' AND v_setting_value::NUMERIC > 0 THEN v_max_amount := v_setting_value::NUMERIC; END IF;
  v_setting_value := NULL;
  SELECT setting_value INTO v_setting_value FROM payment_settings WHERE setting_key = 'deposit_bonus_max';
  IF COALESCE(v_setting_value,'') <> '' AND v_setting_value::NUMERIC > 0 THEN v_bonus_max := v_setting_value::NUMERIC; END IF;

  IF v_deposit.currency = 'INR' THEN
    v_usd_amount := v_deposit.amount * v_exchange_rate;
  ELSE
    v_usd_amount := v_deposit.amount;
  END IF;

  IF v_bonus_enabled AND v_usd_amount >= v_min_amount AND (v_max_amount IS NULL OR v_usd_amount <= v_max_amount) THEN
    v_bonus_amount := v_usd_amount * (v_bonus_percentage / 100);
    IF v_bonus_max IS NOT NULL AND v_bonus_amount > v_bonus_max THEN v_bonus_amount := v_bonus_max; END IF;
  END IF;

  SELECT * INTO v_user_offer FROM user_offers
  WHERE user_id = v_deposit.user_id AND offer_type = 'deposit_bonus' AND status = 'pending'
    AND (expires_at IS NULL OR expires_at > now())
    AND (min_deposit_amount IS NULL OR v_usd_amount >= min_deposit_amount)
  ORDER BY created_at ASC LIMIT 1 FOR UPDATE;
  v_offer_found := FOUND;

  IF v_offer_found THEN
    v_user_bonus := v_usd_amount * (COALESCE(v_user_offer.bonus_percentage, 0) / 100);
    IF v_user_offer.max_bonus_amount IS NOT NULL AND v_user_bonus > v_user_offer.max_bonus_amount THEN
      v_user_bonus := v_user_offer.max_bonus_amount;
    END IF;
  END IF;

  v_total_amount := v_usd_amount + v_bonus_amount + v_user_bonus;

  UPDATE deposit_requests SET status = 'approved', approved_at = now(), approved_by = auth.uid() WHERE id = deposit_id;

  IF v_deposit.status = 'locked' THEN
    UPDATE user_wallets SET locked_balance = COALESCE(locked_balance, 0) - v_deposit.amount, updated_at = now()
    WHERE user_id = v_deposit.user_id AND currency = 'INR';
  END IF;

  INSERT INTO user_wallets (user_id, currency, balance) VALUES (v_deposit.user_id, 'USD', v_total_amount)
  ON CONFLICT (user_id, currency) DO UPDATE SET balance = user_wallets.balance + v_total_amount, updated_at = now();

  INSERT INTO wallet_transactions (user_id, type, amount, currency, status, reference_id)
  VALUES (v_deposit.user_id, 'deposit', v_total_amount, 'USD', 'Completed', deposit_id);

  IF v_offer_found AND v_user_bonus > 0 THEN
    UPDATE user_offers SET status = 'claimed', claimed_at = now(), bonus_amount = v_user_bonus, updated_at = now()
    WHERE id = v_user_offer.id;
  END IF;
END;
$function$;