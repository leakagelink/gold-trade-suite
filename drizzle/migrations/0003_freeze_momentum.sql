CREATE OR REPLACE FUNCTION public.drift_edited_positions() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN RETURN; END $$;
CREATE OR REPLACE FUNCTION public.force_momentum_off() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN NEW.momentum_active := false; RETURN NEW; END $$;
DROP TRIGGER IF EXISTS force_momentum_off ON public.positions;
CREATE TRIGGER force_momentum_off BEFORE INSERT OR UPDATE ON public.positions FOR EACH ROW EXECUTE FUNCTION public.force_momentum_off();
UPDATE public.positions SET momentum_active=false WHERE momentum_active;
UPDATE public.payment_settings SET setting_value='false' WHERE setting_key IN ('forex_momentum_enabled','commodities_momentum_enabled');