do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'friendships_no_self'
  ) then
    alter table friendships
      add constraint friendships_no_self
      check (requester_id <> addressee_id);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'debt_requests_no_self'
  ) then
    alter table debt_requests
      add constraint debt_requests_no_self
      check (creator_id <> approver_id);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'settlements_no_self'
  ) then
    alter table settlements
      add constraint settlements_no_self
      check (payer_id <> receiver_id);
  end if;
end
$$;

create unique index if not exists friendships_pair_unique
on friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));

drop policy if exists "participants can update debt requests" on debt_requests;
drop policy if exists "approver can update debt requests" on debt_requests;

create policy "approver can update debt requests"
on debt_requests for update
to authenticated
using (auth.uid() = approver_id and status = 'pending')
with check (auth.uid() = approver_id);

create or replace function validate_debt_request_update()
returns trigger
language plpgsql
as $$
begin
  if old.status <> 'pending' then
    raise exception 'This debt request has already been responded to.';
  end if;

  if auth.uid() is distinct from old.approver_id then
    raise exception 'Only the approver can respond to this debt request.';
  end if;

  if new.creator_id <> old.creator_id
    or new.approver_id <> old.approver_id
    or new.amount_in_paise <> old.amount_in_paise
    or new.currency <> old.currency
    or new.reason <> old.reason
    or new.debt_date <> old.debt_date
    or new.due_at is distinct from old.due_at
    or new.created_at <> old.created_at then
    raise exception 'Debt request details cannot be edited after creation.';
  end if;

  if new.status not in ('approved', 'rejected') then
    raise exception 'Debt requests can only be approved or rejected.';
  end if;

  if new.status = 'approved' and (new.approved_at is null or new.rejected_at is not null) then
    raise exception 'Approved debt requests must only set approved_at.';
  end if;

  if new.status = 'rejected' and (new.rejected_at is null or new.approved_at is not null) then
    raise exception 'Rejected debt requests must only set rejected_at.';
  end if;

  return new;
end;
$$;

drop trigger if exists debt_request_update_guard on debt_requests;

create trigger debt_request_update_guard
before update on debt_requests
for each row
execute function validate_debt_request_update();
