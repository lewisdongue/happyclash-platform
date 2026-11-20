-- Indexes behind every foreign key, so joins and cascading deletes
-- (deleting an account, a Clash or a video) never scan whole tables.

create index if not exists clash_invites_invited_by_idx on public.clash_invites (invited_by);
create index if not exists clashes_creator_idx on public.clashes (creator_id);
create index if not exists clashes_group_idx on public.clashes (group_id);
create index if not exists clashes_rival_group_idx on public.clashes (rival_group_id);
create index if not exists clashes_winner_entry_idx on public.clashes (winner_entry_id);
create index if not exists duel_votes_answer_idx on public.duel_votes (answer_id);
create index if not exists duel_votes_original_idx on public.duel_votes (original_id);
create index if not exists groups_owner_idx on public.groups (owner_id);
create index if not exists notifications_actor_idx on public.notifications (actor_id);
create index if not exists notifications_clash_idx on public.notifications (clash_id);
create index if not exists notifications_comment_idx on public.notifications (comment_id);
create index if not exists notifications_entry_idx on public.notifications (entry_id);
create index if not exists notifications_group_idx on public.notifications (group_id);
create index if not exists reports_reporter_idx on public.reports (reporter_id);
create index if not exists safety_reports_clash_idx on public.safety_reports (clash_id);
create index if not exists safety_reports_comment_idx on public.safety_reports (comment_id);
create index if not exists safety_reports_entry_idx on public.safety_reports (entry_id);
create index if not exists safety_reports_group_idx on public.safety_reports (group_id);
create index if not exists safety_reports_profile_idx on public.safety_reports (profile_id);
