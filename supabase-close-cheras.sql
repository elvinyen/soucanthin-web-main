update public.store_branches
set active = (id = 'pudu')
where id in ('pudu', 'cheras');
