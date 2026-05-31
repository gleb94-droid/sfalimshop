create or replace function public.protect_order_payment_fields()
returns trigger
language plpgsql
set search_path = public
as $$
declare is_privileged boolean;
begin
  is_privileged := current_user in ('service_role','postgres','supabase_admin','supabase_auth_admin') or public.is_admin();
  if is_privileged then return new; end if;
  if tg_op = 'INSERT' then
    new.payment_status := 'idle';
    new.amount_paid := null;
    new.paid_at := null;
    new.tranzila_transaction_id := null;
    new.payment_method := null;
    new.failed_reason := null;
    new.cancelled_at := null;
    return new;
  end if;
  new.payment_status := old.payment_status;
  new.amount_paid := old.amount_paid;
  new.paid_at := old.paid_at;
  new.total := old.total;
  new.tranzila_transaction_id := old.tranzila_transaction_id;
  new.payment_method := old.payment_method;
  new.currency := old.currency;
  new.failed_reason := old.failed_reason;
  return new;
end; $$;

drop trigger if exists trg_protect_order_payment_fields on public.orders;
create trigger trg_protect_order_payment_fields
  before insert or update on public.orders
  for each row execute function public.protect_order_payment_fields();
