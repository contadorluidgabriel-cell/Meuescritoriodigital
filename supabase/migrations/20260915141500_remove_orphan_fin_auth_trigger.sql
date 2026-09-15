-- Remove um trigger legado de outro módulo que ainda interceptava a criação
-- de usuários do Supabase Auth. A tabela public.fin_profiles não existe mais,
-- então qualquer INSERT em auth.users falhava com "Database error creating new user".

drop trigger if exists fin_on_auth_user_created on auth.users;
drop function if exists public.fin_create_default_profile();
