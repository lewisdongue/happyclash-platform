-- Every new video lasts one minute at most (a second of grace for encoders).
alter table public.entries add constraint entries_one_minute check (duration_ms is null or duration_ms <= 61000) not valid;
alter table public.clashes drop constraint if exists clashes_max_seconds_check;
alter table public.clashes add constraint clashes_max_seconds_check check (max_seconds between 10 and 60);
