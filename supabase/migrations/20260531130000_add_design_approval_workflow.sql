alter table public.orders
  add column if not exists requires_design_approval boolean not null default false,
  add column if not exists design_approval_status text not null default 'not_required',
  add column if not exists design_review_note text,
  add column if not exists design_reviewed_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'orders_design_approval_status_check') then
    alter table public.orders
      add constraint orders_design_approval_status_check
      check (design_approval_status in ('not_required','pending','approved','rejected'));
  end if;
end $$;

create or replace function public.protect_order_payment_fields()
returns trigger language plpgsql set search_path = public as $$
declare is_privileged boolean;
begin
  is_privileged := current_user in ('service_role','postgres','supabase_admin','supabase_auth_admin') or public.is_admin();
  if is_privileged then return new; end if;
  if tg_op = 'INSERT' then
    new.payment_status:='idle'; new.amount_paid:=null; new.paid_at:=null;
    new.tranzila_transaction_id:=null; new.payment_method:=null; new.failed_reason:=null; new.cancelled_at:=null;
    if new.requires_design_approval is true then new.design_approval_status:='pending';
    else new.design_approval_status:='not_required'; end if;
    new.design_review_note:=null; new.design_reviewed_at:=null;
    return new;
  end if;
  new.payment_status:=old.payment_status; new.amount_paid:=old.amount_paid; new.paid_at:=old.paid_at;
  new.total:=old.total; new.tranzila_transaction_id:=old.tranzila_transaction_id;
  new.payment_method:=old.payment_method; new.currency:=old.currency; new.failed_reason:=old.failed_reason;
  new.requires_design_approval:=old.requires_design_approval; new.design_review_note:=old.design_review_note;
  new.design_reviewed_at:=old.design_reviewed_at;
  if not (coalesce(old.design_approval_status,'') = 'rejected' and new.design_approval_status = 'pending') then
    new.design_approval_status:=old.design_approval_status;
  end if;
  return new;
end; $$;

drop trigger if exists trg_protect_order_payment_fields on public.orders;
create trigger trg_protect_order_payment_fields before insert or update on public.orders
  for each row execute function public.protect_order_payment_fields();
