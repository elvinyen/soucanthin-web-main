update public.store_branches
set active = (id = 'cheras'),
    updated_at = now()
where id in ('pudu', 'cheras');
