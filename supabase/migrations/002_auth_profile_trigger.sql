create or replace function public.handle_new_user()
returns trigger as $$
declare
  base_username text;
  safe_username text;
  suffix text;
  profile_display_name text;
begin
  base_username := coalesce(
    new.raw_user_meta_data->>'username',
    split_part(new.email, '@', 1),
    'guest'
  );

  safe_username := regexp_replace(lower(base_username), '[^a-z0-9_]+', '_', 'g');
  safe_username := trim(both '_' from safe_username);
  if safe_username = '' then
    safe_username := 'guest';
  end if;

  suffix := left(replace(new.id::text, '-', ''), 8);
  safe_username := safe_username || '_' || suffix;

  profile_display_name := coalesce(
    new.raw_user_meta_data->>'display_name',
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    new.email,
    'Guest Player'
  );

  insert into public.profiles (id, username, display_name, avatar)
  values (
    new.id,
    safe_username,
    profile_display_name,
    coalesce(new.raw_user_meta_data->>'avatar_url', '')
  )
  on conflict (id) do nothing;

  insert into public.streaks (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$ language plpgsql security definer;
