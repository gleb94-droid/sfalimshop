-- Pre-launch audit fix (item 10): a customer-uploaded design (stored in the
-- 'designs' storage bucket → URL contains '/designs/') MUST go through manual
-- approval on INSERT, regardless of the client-supplied requires_design_approval
-- flag. Closes a content-review bypass (no money loss — server reprices — but a
-- tampered insert could otherwise send un-reviewed artwork straight to print).
-- Only the INSERT branch's force clause is new; all other behavior is unchanged.

CREATE OR REPLACE FUNCTION public.protect_order_payment_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare is_privileged boolean;
begin
  is_privileged := current_user in ('service_role','postgres','supabase_admin','supabase_auth_admin') or public.is_admin();
  if is_privileged then return new; end if;

  if tg_op = 'INSERT' then
    new.payment_status          := 'idle';
    new.amount_paid             := null;
    new.paid_at                 := null;
    new.tranzila_transaction_id := null;
    new.payment_method          := null;
    new.failed_reason           := null;
    new.cancelled_at            := null;
    -- a customer-uploaded design (stored in the 'designs' bucket) MUST go through
    -- manual approval, regardless of the client-supplied flag (anti-tamper).
    if new.design_url is not null and new.design_url like '%/designs/%' then
      new.requires_design_approval := true;
    end if;
    -- approval can never start out as approved
    if new.requires_design_approval is true then
      new.design_approval_status := 'pending';
    else
      new.design_approval_status := 'not_required';
    end if;
    new.design_review_note  := null;
    new.design_reviewed_at  := null;
    return new;
  end if;

  -- UPDATE by a customer: freeze money fields
  new.payment_status          := old.payment_status;
  new.amount_paid             := old.amount_paid;
  new.paid_at                 := old.paid_at;
  new.total                   := old.total;
  new.tranzila_transaction_id := old.tranzila_transaction_id;
  new.payment_method          := old.payment_method;
  new.currency                := old.currency;
  new.failed_reason           := old.failed_reason;
  -- freeze review metadata (only the shop sets these)
  new.requires_design_approval := old.requires_design_approval;
  new.design_review_note       := old.design_review_note;
  new.design_reviewed_at       := old.design_reviewed_at;
  -- allow ONLY a rejected -> pending resubmit; otherwise freeze the approval status
  if not (coalesce(old.design_approval_status, '') = 'rejected' and new.design_approval_status = 'pending') then
    new.design_approval_status := old.design_approval_status;
  end if;
  -- status: a customer may only move their own order to 'cancelled'; revert any other change
  if new.status is distinct from old.status and new.status <> 'cancelled' then
    new.status := old.status;
  end if;
  return new;
end; $function$;
