begin;

do $$
declare
  updated_count integer;
begin
  update public.missions as missions
  set name = names.name
  from (
    values
      (1::smallint, '任務一｜見面聊聊'::text),
      (2::smallint, '任務二｜祝福小物'::text),
      (3::smallint, '任務三｜為他禱告'::text),
      (4::smallint, '任務四｜認識教會朋友'::text),
      (5::smallint, '任務五｜邀約烤肉'::text),
      (6::smallint, '任務六｜邀約來教會'::text)
  ) as names(id, name)
  where missions.id = names.id
    and missions.name is distinct from names.name;

  get diagnostics updated_count = row_count;

  if (select count(*) from public.missions where id between 1 and 6) <> 6 then
    raise exception 'Expected all six mission records before renaming';
  end if;

  if exists (
    select 1
    from public.missions as missions
    join (
      values
        (1::smallint, '任務一｜見面聊聊'::text),
        (2::smallint, '任務二｜祝福小物'::text),
        (3::smallint, '任務三｜為他禱告'::text),
        (4::smallint, '任務四｜認識教會朋友'::text),
        (5::smallint, '任務五｜邀約烤肉'::text),
        (6::smallint, '任務六｜邀約來教會'::text)
    ) as expected(id, name) on expected.id = missions.id
    where missions.name <> expected.name
  ) then
    raise exception 'Mission names did not update as expected';
  end if;

  raise notice 'Mission names updated: % row(s) changed', updated_count;
end;
$$;

commit;
