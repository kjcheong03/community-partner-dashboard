-- Demo-scale request seed data.
-- Seeds 1,000 realistic submissions from 11 May 2026 through 11 Jun 2026, 9:00 am.
-- Safe to rerun: operational seed rows are identified by demo.caregiver.*@orca.sg.
-- Uses normal req-* IDs; ORCA should exclude the operational demo.caregiver.* marker.

begin;

create or replace function pg_temp.demo_uuid(seed text)
returns uuid
language sql
immutable
as $$
  select (
    substr(md5(seed), 1, 8) || '-' ||
    substr(md5(seed), 9, 4) || '-' ||
    substr(md5(seed), 13, 4) || '-' ||
    substr(md5(seed), 17, 4) || '-' ||
    substr(md5(seed), 21, 12)
  )::uuid;
$$;

delete from public.request_sessions
where id like 'demo-seed-%'
  or email like 'demo.caregiver.%@cara.sg'
  or email like 'demo.caregiver.%@orca.sg';

-- Keep inventory useful after a large demo seed: enough stock to show OK/low/out
-- variation once reserved and fulfilled quantities are deducted by the views.
update public.inventory_items
set stock_count = case
  when workspace_id = 'temasek-distribution' and sku = 'masks' then 950
  when workspace_id = 'temasek-distribution' and sku = 'hand-sanitiser' then 420
  when workspace_id = 'moh-art-kit-distribution' and sku = 'art-kits' then 260
  when workspace_id = 'nea-dengue-outreach' and sku = 'dengue-kit-repellent-pack' then 180
  when workspace_id = 'food-from-the-heart' and sku = 'standard-food-pack' then 220
  when workspace_id = 'food-from-the-heart' and sku = 'fresh-food-pack' then 90
  when workspace_id = 'touch-meals-on-wheels' and sku like '%-regular' then 180
  when workspace_id = 'touch-meals-on-wheels' and sku like '%-halal' then 80
  when workspace_id = 'touch-meals-on-wheels' and sku like '%-vegetarian' then 55
  when workspace_id = 'touch-meals-on-wheels' and sku like '%-soft-food' then 45
  when workspace_id = 'touch-meals-on-wheels' and sku like '%-low-sugar' then 45
  when workspace_id = 'touch-meals-on-wheels' and sku like '%-low-salt' then 45
  when workspace_id = 'touch-meals-on-wheels' and sku like '%-special' then 30
  else stock_count
end
where workspace_id in (
  'temasek-distribution',
  'moh-art-kit-distribution',
  'nea-dengue-outreach',
  'food-from-the-heart',
  'touch-meals-on-wheels'
);

create temporary table demo_areas (
  area text primary key,
  postal_prefix text not null,
  senior_weight integer not null,
  welfare_weight integer not null default 0,
  welfare_area boolean not null default false
) on commit drop;

insert into demo_areas (area, postal_prefix, senior_weight, welfare_weight, welfare_area)
values
  ('Bedok', '46', 90, 0, false),
  ('Tampines', '52', 76, 0, false),
  ('Hougang', '53', 73, 0, false),
  ('Ang Mo Kio', '56', 70, 45, true),
  ('Jurong West', '64', 66, 0, false),
  ('Bukit Merah', '15', 66, 0, false),
  ('Yishun', '76', 57, 0, false),
  ('Toa Payoh', '31', 51, 33, true),
  ('Woodlands', '73', 51, 0, false),
  ('Sengkang', '54', 48, 0, false),
  ('Serangoon', '55', 45, 0, false),
  ('Bukit Batok', '65', 43, 0, false),
  ('Kallang', '33', 42, 0, false),
  ('Geylang', '38', 42, 0, false),
  ('Queenstown', '14', 40, 0, false),
  ('Choa Chu Kang', '68', 40, 0, false),
  ('Clementi', '12', 37, 0, false),
  ('Bukit Panjang', '67', 35, 0, false),
  ('Pasir Ris', '51', 33, 0, false),
  ('Bishan', '57', 32, 22, true),
  ('Jurong East', '60', 30, 0, false),
  ('Punggol', '82', 27, 0, false),
  ('Bukit Timah', '58', 26, 0, false),
  ('Marine Parade', '44', 18, 0, false),
  ('Sembawang', '75', 18, 0, false),
  ('Novena', '30', 17, 0, false),
  ('Central Area', '05', 14, 0, false),
  ('Tanglin', '24', 7, 0, false),
  ('Changi', '49', 6, 0, false),
  ('Boon Lay', '64', 4, 0, false);

create temporary table demo_assignees (
  workspace_id text not null,
  assignee_order integer not null,
  assignee_name text not null,
  primary key (workspace_id, assignee_order)
) on commit drop;

insert into demo_assignees (workspace_id, assignee_order, assignee_name)
values
  ('allkin-aac-amk', 1, 'Aisha Rahman'),
  ('allkin-aac-amk', 2, 'Ben Tan'),
  ('allkin-aac-amk', 3, 'Cheryl Lim'),
  ('allkin-aac-amk', 4, 'Daniel Goh'),
  ('care-corner-aac-toa-payoh', 1, 'Mei Lin Chua'),
  ('care-corner-aac-toa-payoh', 2, 'Siti Nur Aisyah'),
  ('care-corner-aac-toa-payoh', 3, 'Alvin Ong'),
  ('care-corner-aac-toa-payoh', 4, 'Priya Nair'),
  ('st-lukes-aac-bishan', 1, 'Rachel Foo'),
  ('st-lukes-aac-bishan', 2, 'Mark Lee'),
  ('st-lukes-aac-bishan', 3, 'Jasmin Koh'),
  ('st-lukes-aac-bishan', 4, 'Samuel Tan'),
  ('aic-link', 1, 'Nadia Lim'),
  ('aic-link', 2, 'Farhan Ismail'),
  ('aic-link', 3, 'Grace Teo'),
  ('aic-link', 4, 'Marcus Wong'),
  ('touch-medical-escort-transport', 1, 'Wei Ming Tan'),
  ('touch-medical-escort-transport', 2, 'Nora Lim'),
  ('touch-medical-escort-transport', 3, 'Isaac Koh'),
  ('touch-medical-escort-transport', 4, 'Felicia Chua');

create temporary table demo_route_specs (
  support_key text not null,
  ordinal integer not null,
  label text not null,
  workspace_id text not null,
  organisation_id text,
  route_type public.route_type not null,
  route_name text not null,
  logo_path text not null,
  availability_mode public.availability_mode not null,
  cost_label text not null,
  detail text not null,
  route_status text not null,
  sku text not null,
  primary key (support_key, ordinal)
) on commit drop;

insert into demo_route_specs (
  support_key,
  ordinal,
  label,
  workspace_id,
  organisation_id,
  route_type,
  route_name,
  logo_path,
  availability_mode,
  cost_label,
  detail,
  route_status,
  sku
)
values
  (
    'supplies',
    1,
    'Masks',
    'temasek-distribution',
    null,
    'public_distribution',
    'Temasek Foundation distribution exercise',
    '/logos/temasek.png',
    'active_distribution_exercise',
    'No charge',
    'Mask collection from community distribution shelves.',
    'Match inventory and arrange pickup',
    'masks'
  ),
  (
    'supplies',
    2,
    'Hand sanitiser',
    'temasek-distribution',
    null,
    'public_distribution',
    'Temasek Foundation distribution exercise',
    '/logos/temasek.png',
    'active_distribution_exercise',
    'No charge',
    'Hand sanitiser from Temasek community stock.',
    'Match inventory and arrange pickup',
    'hand-sanitiser'
  ),
  (
    'supplies',
    3,
    'ART kits',
    'moh-art-kit-distribution',
    null,
    'public_distribution',
    'Ministry of Health ART kit distribution',
    '/logos/moh.png',
    'active_distribution_exercise',
    'No charge',
    'ART kits for caregivers monitoring respiratory symptoms.',
    'Match inventory and arrange pickup',
    'art-kits'
  ),
  (
    'supplies',
    4,
    'Dengue kit / repellent pack',
    'nea-dengue-outreach',
    null,
    'community_distribution',
    'NEA dengue outreach / local community club',
    '/logos/nea.png',
    'active_distribution_exercise',
    'No charge',
    'Repellent pack and dengue prevention leaflets.',
    'Coordinate local collection',
    'dengue-kit-repellent-pack'
  ),
  (
    'cooked',
    1,
    'Cooked meals',
    'touch-meals-on-wheels',
    'touch-meals-on-wheels',
    'partner_service',
    'TOUCH Meals-on-Wheels',
    '/logos/touch.png',
    'partner_assessment',
    '$4.90-$7.00 / meal',
    'Daily cooked meal delivery matched to dietary needs.',
    'Confirm meal plan with provider',
    'cooked-meal'
  ),
  (
    'food_pack',
    1,
    'Food pack / rations',
    'food-from-the-heart',
    'food-from-the-heart',
    'partner_service',
    'Food from the Heart',
    '/logos/food-from-the-heart.png',
    'partner_assessment',
    'No charge',
    'Pack groceries for caregiver pickup or home delivery.',
    'Confirm pack and dispatch method',
    'standard-food-pack'
  );

create temporary table demo_base on commit drop as
with params as (
  select
    timestamptz '2026-05-11 08:00:00+08' as seed_start,
    timestamptz '2026-06-11 09:00:00+08' as seed_end
),
series as (
  select
    g.n,
    1 + ((g.n * 251) % 480) as identity_index,
    seed_start,
    seed_end
  from params
  cross join generate_series(1, 1000) as g(n)
),
kinded as (
  select
    s.*,
    case
      when (s.n * 37) % 100 < 32 then 'supplies'
      when (s.n * 37) % 100 < 48 then 'welfare'
      when (s.n * 37) % 100 < 61 then 'referral'
      when (s.n * 37) % 100 < 73 then 'transport'
      when (s.n * 37) % 100 < 87 then 'cooked'
      else 'food_pack'
    end as support_key
  from series s
),
timed as (
  select
    k.*,
    t.created_at,
    extract(epoch from (k.seed_end - t.created_at)) / 86400.0 as age_days,
    (k.n * 53) % 100 as status_bucket
  from kinded k
  cross join lateral (
    select k.seed_start + ((k.seed_end - k.seed_start) * (((k.n - 1)::double precision) / 999.0)) as created_at
  ) t
),
aread as (
  select
    t.*,
    a.area,
    a.postal_prefix
  from timed t
  cross join lateral (
    select area, postal_prefix
    from (
      select
        da.*,
        sum(case when t.support_key = 'welfare' then da.welfare_weight else da.senior_weight end) over (order by da.area) as cutoff,
        sum(case when t.support_key = 'welfare' then da.welfare_weight else da.senior_weight end) over () as total
      from demo_areas da
      where t.support_key <> 'welfare'
        or da.welfare_area
    ) weighted
    where ((t.identity_index * 7919 + 17) % weighted.total) < weighted.cutoff
    order by weighted.cutoff
    limit 1
  ) a
),
statused as (
  select
    a.*,
    case
      when a.support_key in ('welfare', 'referral', 'transport') then
        case
          when a.age_days < 1.25 and a.status_bucket < 35 then 'Pending'
          when a.age_days < 1.25 and a.status_bucket < 90 then 'In progress'
          when a.age_days < 1.25 and a.status_bucket < 95 then 'Completed'
          when a.age_days < 1.25 and a.status_bucket < 98 then 'Rejected'
          when a.age_days < 1.25 then 'Cancelled'
          when a.age_days < 7 and a.status_bucket < 12 then 'Pending'
          when a.age_days < 7 and a.status_bucket < 60 then 'In progress'
          when a.age_days < 7 and a.status_bucket < 90 then 'Completed'
          when a.age_days < 7 and a.status_bucket < 96 then 'Rejected'
          when a.age_days < 7 then 'Cancelled'
          when a.status_bucket < 3 then 'Pending'
          when a.status_bucket < 15 then 'In progress'
          when a.status_bucket < 80 then 'Completed'
          when a.status_bucket < 92 then 'Rejected'
          else 'Cancelled'
        end::public.request_status
      else
        case
          when a.age_days < 1.25 and a.status_bucket < 35 then 'Pending'
          when a.age_days < 1.25 and a.status_bucket < 55 then 'Accepted'
          when a.age_days < 1.25 and a.status_bucket < 90 then 'In progress'
          when a.age_days < 1.25 then 'Completed'
          when a.age_days < 7 and a.status_bucket < 15 then 'Pending'
          when a.age_days < 7 and a.status_bucket < 30 then 'Accepted'
          when a.age_days < 7 and a.status_bucket < 65 then 'In progress'
          when a.age_days < 7 and a.status_bucket < 95 then 'Completed'
          when a.age_days < 7 then 'Cancelled'
          when a.status_bucket < 4 then 'Pending'
          when a.status_bucket < 10 then 'Accepted'
          when a.status_bucket < 22 then 'In progress'
          when a.status_bucket < 92 then 'Completed'
          else 'Cancelled'
        end::public.request_status
    end as raw_status
  from aread a
),
orged as (
  select
    s.*,
    case
      when s.support_key = 'welfare' and s.area = 'Ang Mo Kio' then 'allkin-aac-amk'
      when s.support_key = 'welfare' and s.area = 'Toa Payoh' then 'care-corner-aac-toa-payoh'
      when s.support_key = 'welfare' then 'st-lukes-aac-bishan'
      when s.support_key = 'referral' then 'aic-link'
      when s.support_key = 'transport' then 'touch-medical-escort-transport'
      else null
    end as original_org_id
  from statused s
)
select
  o.n,
  o.identity_index,
  'req-' || to_char(o.created_at at time zone 'Asia/Singapore', 'YYYYMMDD') || '-' || lpad(o.n::text, 4, '0') as session_id,
  pg_temp.demo_uuid('demo-task:' || o.n::text) as task_id,
  o.support_key,
  case when o.support_key in ('cooked', 'food_pack') then 'food' else o.support_key end::public.support_type as support_type,
  o.created_at,
  o.area,
  o.postal_prefix || lpad(((1000 + (o.identity_index * 73) % 8999))::text, 4, '0') as postal_code,
  'Blk ' || (1 + (o.identity_index * 17) % 890)::text || ' ' || o.area || ' Ave ' || (1 + (o.identity_index * 7) % 9)::text ||
    ', #' || lpad(((2 + o.identity_index % 25))::text, 2, '0') || '-' || lpad(((10 + o.identity_index * 3) % 99)::text, 2, '0') ||
    ', Singapore ' || o.postal_prefix || lpad(((1000 + (o.identity_index * 73) % 8999))::text, 4, '0') as address,
  case
    when o.identity_index <= 270 then
      (array[
        'Chloe', 'Marcus', 'Jia Min', 'Mei Ling', 'Daniel', 'Hui Fen', 'Raymond', 'Wei Jie', 'Kenneth', 'Ben',
        'Cheryl', 'Eleanor', 'Grace', 'Irene', 'Jasmine', 'Kok Leong', 'Mabel', 'Owen', 'Pei Shan', 'Terence',
        'Victor', 'Wen Xin', 'Xavier', 'Zachary', 'Alvin', 'Brenda', 'Cecilia', 'Darren', 'Evelyn', 'Gerald',
        'Hannah', 'Isaac', 'Janice', 'Kelvin', 'Li Wen', 'Nicholas', 'Olivia', 'Qian Yi', 'Rachel', 'Samuel',
        'Tessa', 'Vincent', 'Wan Ting', 'Xinyi', 'Adeline', 'Bryan', 'Clarissa', 'Edmund', 'Fiona', 'Gavin',
        'Hazel', 'Ivan', 'Joanne', 'Leah', 'Natalie', 'Sean', 'Rebecca', 'Aaron', 'Denise', 'Shermaine'
      ])[1 + ((o.identity_index - 1) % 60)] || ' ' ||
      (array['Tan', 'Lim', 'Lee', 'Ng', 'Wong'])[1 + (((o.identity_index - 1) / 54)::integer % 5)]
    when o.identity_index <= 360 then
      (array[
        'Nur Aini', 'Sofia', 'Nadia', 'Farah', 'Aisha', 'Fadli', 'Liyana', 'Qistina', 'Siti Nur Aisyah', 'Danish',
        'Farhan', 'Maryam', 'Yasmin', 'Yusuf', 'Zara', 'Hidayah', 'Izzati', 'Amir', 'Hakim', 'Nabil',
        'Syafiq', 'Shafiqah', 'Aminah', 'Khairul', 'Raihan', 'Haziq', 'Nadiah', 'Iman', 'Maisarah', 'Afiq'
      ])[1 + ((o.identity_index - 241) % 30)] || ' ' ||
      (array['Rahman', 'Ismail', 'Ahmad'])[1 + (((o.identity_index - 271) / 30)::integer % 3)]
    when o.identity_index <= 432 then
      (array[
        'Arun', 'Kavitha', 'Priya', 'Harjit', 'Ravi', 'Uma', 'Prakash', 'Usha',
        'Devika', 'Lakshmi', 'Meena', 'Suresh', 'Anjali', 'Deepa', 'Rajesh', 'Sanjay',
        'Vani', 'Nisha', 'Ramesh', 'Kiran', 'Pooja', 'Geetha', 'Vikram', 'Asha'
      ])[1 + ((o.identity_index - 361) % 24)] || ' ' ||
      (array['Kumar', 'Nair', 'Menon'])[1 + (((o.identity_index - 361) / 24)::integer % 3)]
    when o.identity_index <= 448 then
      (array[
        'Maria Santos', 'Ana Reyes', 'Lorna Cruz', 'Grace Dela Cruz',
        'Rosa Garcia', 'Maribel Flores', 'Elena Ramos', 'Jocelyn Mendoza',
        'Carmen Aquino', 'Teresita Lopez', 'Nora Castillo', 'Leah Bautista',
        'Mylene Navarro', 'Irene Mercado', 'Janice Villanueva', 'Daisy Rivera'
      ])[1 + ((o.identity_index - 433) % 16)]
    when o.identity_index <= 464 then
      (array[
        'Siti Wulandari', 'Dewi Lestari', 'Nurhayati Santoso', 'Rina Kartika',
        'Sri Wahyuni', 'Fitri Handayani', 'Yuliana Putri', 'Maya Sari',
        'Endah Pratiwi', 'Ayu Permata', 'Ratna Hidayati', 'Lilis Kurnia',
        'Nia Rahmawati', 'Tuti Susanti', 'Indah Puspita', 'Wati Anggraini'
      ])[1 + ((o.identity_index - 449) % 16)]
    else
      (array[
        'Daw May Thandar', 'Khin Sandar', 'Aye Aye Win', 'Nandar Hlaing',
        'Su Mon Kyaw', 'Thin Thin Aye', 'Moe Moe Lwin', 'Hnin Ei Phyu',
        'Yu Yu Htwe', 'Ei Ei Mon', 'Nwe Ni Win', 'Phyu Phyu Thein',
        'Cho Cho Mar', 'Thandar Soe', 'May Zin Oo', 'Khin Hnin Wai'
      ])[1 + ((o.identity_index - 465) % 16)]
  end as caregiver_name,
  case
    when o.identity_index <= 270 then
      (array['Mdm', 'Mr'])[1 + ((o.identity_index - 1) % 2)] || ' ' ||
      (array['Tan', 'Lim', 'Lee', 'Ng', 'Wong'])[1 + (((o.identity_index - 1) / 54)::integer % 5)] || ' ' ||
      (array[
        'Bee Hoon', 'Ah Seng', 'Siew Lan', 'Chee Meng', 'Lay Hoon', 'Hock Seng', 'Mei Lan', 'Kok Wai', 'Poh Choo', 'Kim Huat',
        'Lai Fong', 'Boon Kiat', 'Geok Lan', 'Siew Cheng', 'Ai Lian', 'Hock Chye', 'Wai Ling', 'Bee Leng', 'Geok Hoon', 'Kian Seng',
        'Mui Hoon', 'Boon Heng', 'Siew Tin', 'Chee Wee', 'Peck Lan', 'Kok Leong', 'Lay Kheng', 'Soon Huat', 'Ah Moy', 'Mui Geok',
        'Peng Huat', 'Sock Hoon', 'Teck Seng', 'Mei Fong', 'Soon Lee', 'Chwee Hoon', 'Cheng Ann', 'Siew Eng', 'Fook Seng', 'Lai Yin',
        'Kok Wee', 'Lay Sim', 'Beng Chye', 'Soon Kiat', 'Mui Lan', 'Hock Ann', 'Siew Kee', 'Bee Kim', 'Kim Seng', 'Wai Leng',
        'Geok Tin', 'Siew Mei', 'Chee Hong', 'Lai Kuan', 'Peng Yam', 'Sock Cheng', 'Hwee Ling', 'Boon Chye', 'Mei Hwa', 'Chin Huat'
      ])[1 + ((o.identity_index - 1) % 60)]
    when o.identity_index <= 360 then
      case
        when (o.identity_index - 271) % 2 = 0 then
          'Mdm ' ||
          (array[
            'Rahimah', 'Zainab', 'Aminah', 'Faridah', 'Mariam',
            'Rokiah', 'Salmah', 'Hasnah', 'Ramlah', 'Noraini',
            'Sakdiah', 'Halijah', 'Kalsom', 'Rashidah', 'Jamilah'
          ])[1 + (((o.identity_index - 271) / 2)::integer % 15)] || ' '
        else
          'Mr ' ||
          (array[
            'Salleh', 'Hamid', 'Yusof', 'Aziz', 'Hassan',
            'Ibrahim', 'Othman', 'Jamal', 'Kassim', 'Basri',
            'Latif', 'Mahmud', 'Ridzuan', 'Sulaiman', 'Fauzi'
          ])[1 + (((o.identity_index - 272) / 2)::integer % 15)] || ' '
      end ||
      (array['Abdullah', 'Rahman', 'Ismail'])[1 + (((o.identity_index - 271) / 30)::integer % 3)]
    when o.identity_index <= 432 then
      case
        when (o.identity_index - 361) % 2 = 0 then
          'Mdm ' ||
          (array[
            'Lakshmi', 'Meena', 'Anjali', 'Devi', 'Kamala',
            'Vasantha', 'Parvathi', 'Leela', 'Radha', 'Mala',
            'Prema', 'Shanti'
          ])[1 + (((o.identity_index - 361) / 2)::integer % 12)] || ' '
        else
          'Mr ' ||
          (array[
            'Ravi', 'Suresh', 'Raj', 'Kumar', 'Maniam',
            'Rajan', 'Subramaniam', 'Gopal', 'Krishnan', 'Muthu',
            'Selvam', 'Bala'
          ])[1 + (((o.identity_index - 362) / 2)::integer % 12)] || ' '
      end ||
      (array['Kumar', 'Nair', 'Menon'])[1 + (((o.identity_index - 361) / 24)::integer % 3)]
    else
      (array['Mdm', 'Mr'])[1 + ((o.identity_index - 433) % 2)] || ' ' ||
      (array['Seah', 'Koh', 'Teo', 'Yeo', 'Low', 'Chua'])[1 + (((o.identity_index - 433) / 8)::integer % 6)] || ' ' ||
      (array[
        'Bee Hoon', 'Ah Seng', 'Siew Lan', 'Chee Meng', 'Lay Hoon', 'Hock Seng', 'Mei Lan', 'Kok Wai',
        'Poh Choo', 'Kim Huat', 'Lai Fong', 'Boon Kiat', 'Geok Lan', 'Siew Cheng', 'Ai Lian', 'Hock Chye',
        'Wai Ling', 'Bee Leng', 'Geok Hoon', 'Kian Seng', 'Mui Hoon', 'Boon Heng', 'Siew Tin', 'Chee Wee',
        'Peck Lan', 'Kok Leong', 'Lay Kheng', 'Soon Huat', 'Ah Moy', 'Mui Geok', 'Peng Huat', 'Sock Hoon',
        'Teck Seng', 'Mei Fong', 'Soon Lee', 'Chwee Hoon', 'Cheng Ann', 'Siew Eng', 'Fook Seng', 'Lai Yin',
        'Kok Wee', 'Lay Sim', 'Beng Chye', 'Soon Kiat', 'Mui Lan', 'Hock Ann', 'Siew Kee', 'Bee Kim'
      ])[1 + ((o.identity_index - 433) % 48)]
  end as care_recipient_name,
  '+65 ' || (8000 + (o.identity_index * 37) % 1000)::text || ' ' || lpad(((1000 + o.identity_index * 91) % 10000)::text, 4, '0') as contact_number,
  (array['WhatsApp', 'Phone call', 'SMS', 'Email'])[1 + (o.identity_index % 4)] as contact_method,
  lower('demo.caregiver.' || lpad(o.identity_index::text, 3, '0') || '@orca.sg') as email,
  case
    when o.identity_index > 432 then 'Domestic helper'
    else (array['Daughter', 'Son', 'Spouse', 'Neighbour', 'Niece', 'Grandchild'])[1 + ((o.identity_index * 3) % 6)]
  end as relationship,
  case when o.identity_index % 4 = 0 then 'Lift landing is dim after 7 pm.' else 'Use lift lobby A; call before arriving.' end as access_notes,
  o.raw_status,
  (
    o.support_key = 'welfare'
    and o.raw_status = 'Rejected'::public.request_status
    and o.n % 2 = 0
  ) as was_rerouted,
  o.original_org_id,
  case
    when o.original_org_id = 'allkin-aac-amk' then 'care-corner-aac-toa-payoh'
    when o.original_org_id = 'care-corner-aac-toa-payoh' then 'st-lukes-aac-bishan'
    when o.original_org_id = 'st-lukes-aac-bishan' then 'allkin-aac-amk'
    else o.original_org_id
  end as reroute_to_org_id,
  case
    when o.support_key = 'welfare'
      and o.raw_status = 'Rejected'::public.request_status
      and o.n % 2 = 0
      then case when o.n % 3 = 0 then 'In progress' else 'Pending' end::public.request_status
    else o.raw_status
  end as final_status,
  case (o.n % 7)
    when 1 then 'Halal'
    when 2 then 'Vegetarian'
    when 3 then 'Soft food'
    when 4 then 'Low sugar'
    when 5 then 'Low salt'
    when 6 then 'Special'
    else 'Regular'
  end as diet_label,
  case (o.n % 7)
    when 1 then 'halal'
    when 2 then 'vegetarian'
    when 3 then 'soft-food'
    when 4 then 'low-sugar'
    when 5 then 'low-salt'
    when 6 then 'special'
    else 'regular'
  end as diet_slug,
  case
    when o.n % 3 = 0 then array['Lunch', 'Dinner']::text[]
    when o.n % 2 = 0 then array['Lunch']::text[]
    else array['Dinner']::text[]
  end as meals_needed,
  case
    when o.n % 5 = 0 then 'Fresh food pack'
    else 'Standard food pack'
  end as food_pack_label,
  case
    when o.n % 5 = 0 then 'fresh-food-pack'
    else 'standard-food-pack'
  end as food_pack_sku,
  case
    when o.n % 6 in (0, 1) then 'Deliver to home'
    else 'Collect from distribution point'
  end as supplies_fulfilment,
  case
    when o.n % 4 in (0, 1) then 'Deliver'
    when o.n % 4 = 2 then 'Collect'
    else 'Either'
  end as food_pack_fulfilment,
  case
    when o.raw_status in ('Rejected'::public.request_status, 'Cancelled'::public.request_status)
      then (array[
        'No team capacity for this time window.',
        'Unable to reach caregiver after repeated calls.',
        'Recipient needs a different service pathway.',
        'Address is outside this partner run.'
      ])[1 + (o.n % 4)]
    else null
  end as rejection_reason
from orged o;

create temporary table demo_routes_seed on commit drop as
select
  b.n,
  b.session_id,
  b.task_id,
  pg_temp.demo_uuid('demo-route:' || b.n::text || ':' || spec.label) as route_id,
  b.support_key,
  spec.ordinal,
  spec.label,
  spec.workspace_id,
  spec.organisation_id,
  spec.route_type,
  spec.route_name,
  spec.logo_path,
  spec.availability_mode,
  spec.cost_label,
  spec.detail,
  spec.route_status,
  case
    when b.support_key = 'food_pack' then b.food_pack_sku
    else spec.sku
  end as sku,
  case
    when b.support_key = 'supplies' then 1 + ((b.n + spec.ordinal) % 3)
    when b.support_key = 'food_pack' and b.n % 5 = 0 then 2
    when b.support_key = 'food_pack' then 1
    when b.support_key = 'cooked' and b.n % 4 = 0 then 2
    else 1
  end as quantity,
  case
    when b.support_key = 'supplies'
      and b.final_status = 'Completed'::public.request_status
      and (b.n + spec.ordinal) % 7 = 0 then 'In progress'
    when b.support_key = 'supplies'
      and b.final_status = 'In progress'::public.request_status
      and (b.n + spec.ordinal) % 5 = 0 then 'Accepted'
    when b.support_key = 'supplies'
      and b.final_status = 'Accepted'::public.request_status
      and (b.n + spec.ordinal) % 4 = 0 then 'Pending'
    else b.final_status::text
  end::public.request_status as route_lifecycle,
  case
    when b.support_key = 'supplies' and b.supplies_fulfilment ilike '%deliver%' then 'out_for_delivery'
    when b.support_key = 'food_pack' and b.food_pack_fulfilment ilike '%deliver%' then 'out_for_delivery'
    else 'ready_for_pickup'
  end as handoff_stage,
  b.created_at
from demo_base b
join demo_route_specs spec
  on (
    b.support_key in ('cooked', 'food_pack')
    and spec.support_key = b.support_key
  )
  or (
    b.support_key = 'supplies'
    and spec.support_key = 'supplies'
    and spec.ordinal in (
      1 + ((b.n * 5) % 4),
      case when b.n % 3 = 0 then 1 + ((b.n * 7 + 1) % 4) else 0 end,
      case when b.n % 7 = 0 then 1 + ((b.n * 11 + 2) % 4) else 0 end
    )
  );

insert into public.request_sessions (
  id,
  created_by,
  caregiver_name,
  care_recipient_name,
  contact_number,
  contact_method,
  email,
  relationship,
  general_area,
  address,
  postal_code,
  access_notes,
  linked_topic,
  overall_status,
  created_at,
  updated_at
)
select
  b.session_id,
  null::uuid,
  b.caregiver_name,
  b.care_recipient_name,
  b.contact_number,
  b.contact_method,
  b.email,
  b.relationship,
  b.area,
  b.address,
  b.postal_code,
  b.access_notes,
  case
    when b.support_key = 'welfare' then 'care-recipient-check-in'
    when b.support_key = 'transport' then 'appointment-transport'
    when b.support_key = 'referral' then 'care-navigation'
    when b.support_key in ('cooked', 'food_pack') then 'meal-support'
    else 'home-supplies'
  end,
  case
    when b.support_key in ('supplies', 'cooked', 'food_pack') then (
      select public.rollup_request_status(array_agg(r.route_lifecycle order by r.label))
      from demo_routes_seed r
      where r.n = b.n
    )
    else b.final_status
  end,
  b.created_at,
  b.created_at
from demo_base b;

insert into public.request_tasks (
  id,
  session_id,
  task_key,
  support_type,
  fulfilment,
  primary_org_id,
  fallback_org_ids,
  selected_subtypes,
  details,
  cost_estimate,
  status,
  rejection_reason,
  assigned_to,
  scheduled_for,
  partner_notes,
  created_at,
  updated_at
)
select
  b.task_id,
  b.session_id,
  b.support_key,
  b.support_type,
  case when b.support_key in ('supplies', 'cooked', 'food_pack') then 'route' else 'partner' end::public.fulfilment_kind,
  case
    when b.support_key in ('supplies', 'cooked', 'food_pack') then null
    when b.was_rerouted then b.reroute_to_org_id
    else b.original_org_id
  end,
  array[]::text[],
  case
    when b.support_key in ('supplies', 'cooked', 'food_pack') then (
      select array_agg(r.label order by r.label)
      from demo_routes_seed r
      where r.n = b.n
    )
    when b.support_key = 'welfare' then array['Welfare check']
    when b.support_key = 'transport' then array['Medical transport']
    when b.support_key = 'referral' then array['Care referral']
    else array[]::text[]
  end,
  case
    when b.support_key = 'supplies' then jsonb_build_object(
      'itemsNeeded', coalesce((
        select jsonb_agg(jsonb_build_object('item', r.label, 'quantity', r.quantity::text) order by r.label)
        from demo_routes_seed r
        where r.n = b.n
      ), '[]'::jsonb),
      'neededBy', case when b.n % 3 = 0 then 'Today' when b.n % 3 = 1 then 'Tomorrow' else 'This week' end,
      'suppliesFulfilment', b.supplies_fulfilment,
      'preferredCollectionArea', b.area,
      'preferredCollectionTime', case when b.n % 2 = 0 then 'Morning' else 'Afternoon' end,
      'preferredDeliveryTime', case when b.n % 2 = 0 then '10 am - 12 pm' else '2 pm - 5 pm' end,
      'notes', case when b.n % 5 = 0 then 'Caregiver can collect only after work.' else 'Call caregiver before confirming stock.' end
    )
    when b.support_key = 'cooked' then jsonb_build_object(
      'portionsPerMeal', case when b.n % 4 = 0 then 2 else 1 end,
      'mealsNeeded', to_jsonb(b.meals_needed),
      'startDate', case when b.n % 3 = 0 then 'Today' when b.n % 3 = 1 then 'Tomorrow' else 'Choose date' end,
      'startDateValue', (b.created_at::date + ((b.n % 4)::text || ' days')::interval)::date::text,
      'duration', case when b.n % 4 = 0 then '1 week' when b.n % 4 = 1 then '2-3 days' else 'Today only' end,
      'dietaryRestrictions', case when b.diet_slug = 'regular' then '[]'::jsonb else jsonb_build_array(b.diet_label) end,
      'dietaryRestrictionsOther', case when b.diet_slug = 'special' then 'Avoid peanuts; softer rice preferred.' else null end,
      'preferredDeliveryTime', case when b.n % 2 = 0 then 'Lunch run' else 'Dinner run' end,
      'notes', 'Add to Meals-on-Wheels run after provider confirms meal plan.'
    )
    when b.support_key = 'food_pack' then jsonb_build_object(
      'packType', b.food_pack_label,
      'numberOfPacks', case when b.n % 5 = 0 then '2' else '1' end,
      'neededBy', case when b.n % 3 = 0 then 'Today' when b.n % 3 = 1 then 'Tomorrow' else 'This week' end,
      'fulfilmentMethod', b.food_pack_fulfilment,
      'preferredDeliveryWindow', case when b.n % 2 = 0 then 'Morning' else 'Afternoon' end,
      'pickupArea', b.area,
      'pickupTime', case when b.n % 2 = 0 then '9 am - 12 pm' else '2 pm - 5 pm' end,
      'generalPreferredArea', b.area,
      'timingConstraints', case when b.n % 6 = 0 then 'Caregiver is available only after 4 pm.' else null end,
      'foodRestrictions', case when b.n % 4 = 0 then jsonb_build_array('No beef') else '[]'::jsonb end,
      'restrictionNotes', case when b.n % 4 = 0 then 'Recipient avoids beef products.' else null end
    )
    when b.support_key = 'welfare' then jsonb_build_object(
      'specifyOther', case when b.n % 9 = 0 then 'Caregiver has not heard back since yesterday.' else null end,
      'checkMethod', (array['Phone call', 'Home visit', 'Video call'])[1 + (b.n % 3)],
      'checkInDay', case when b.n % 4 = 0 then 'Today' when b.n % 4 = 1 then 'Tomorrow' else 'Choose date' end,
      'checkInDayValue', (b.created_at::date + ((b.n % 3)::text || ' days')::interval)::date::text,
      'preferredTime', (array['Morning', 'Afternoon', 'Evening'])[1 + ((b.n * 2) % 3)],
      'language', (array['English', 'Mandarin', 'Malay', 'Tamil', 'Hokkien'])[1 + (b.n % 5)],
      'safetyNotes', case when b.n % 5 = 0 then 'Recipient may not open door to unfamiliar visitors.' else null end,
      'notes', 'Please update caregiver after the check.'
    )
    when b.support_key = 'transport' then jsonb_build_object(
      'destination', (array['Tan Tock Seng Hospital', 'Singapore General Hospital', 'National Heart Centre', 'Polyclinic appointment', 'Rehabilitation centre'])[1 + (b.n % 5)],
      'appointmentDateTime', to_jsonb(b.created_at + interval '3 days' + (((9 + (b.n % 7))::text || ' hours')::interval)),
      'pickupArea', b.area,
      'wheelchairRequired', b.n % 4 = 0,
      'escortNeeded', b.n % 3 = 0,
      'caregiverAccompanying', b.n % 2 = 0,
      'returnTripNeeded', b.n % 5 <> 0,
      'mobilityNeeds', case when b.n % 4 = 0 then 'Wheelchair assistance from lift lobby.' else 'Slow walking pace; allow buffer time.' end,
      'notes', 'Confirm pickup timing with caregiver before dispatch.'
    )
    else jsonb_build_object(
      'specifyOther', case when b.n % 8 = 0 then 'Unsure which care service applies.' else null end,
      'mainConcern', (array['Long-term care options', 'Subsidy and financial help', 'Home nursing advice', 'Dementia support', 'Caregiver respite'])[1 + (b.n % 5)],
      'currentSituation', 'Caregiver needs help navigating next steps and matching services.',
      'language', (array['English', 'Mandarin', 'Malay', 'Tamil'])[1 + (b.n % 4)],
      'existingSupport', case when b.n % 3 = 0 then 'Currently receives informal neighbour support.' else 'No formal support yet.' end,
      'notes', 'Call caregiver to triage and advise on next service.'
    )
  end,
  case
    when b.support_key = 'cooked' then jsonb_build_object('label', '$4.90-$7.00 / meal', 'min', 4.90, 'max', 7.00, 'unit', 'meal')
    else null
  end,
  case
    when b.support_key in ('supplies', 'cooked', 'food_pack') then (
      select public.rollup_request_status(array_agg(r.route_lifecycle order by r.label))
      from demo_routes_seed r
      where r.n = b.n
    )
    else b.final_status
  end,
  case when b.was_rerouted then null else b.rejection_reason end,
  null,
  null,
  case
    when b.final_status = 'Completed'::public.request_status then 'Completed in the partner dashboard.'
    when b.final_status = 'Cancelled'::public.request_status then 'Cancelled after partner review.'
    else null
  end,
  b.created_at,
  b.created_at
from demo_base b;

insert into public.request_routes (
  id,
  task_id,
  workspace_id,
  organisation_id,
  label,
  route_name,
  logo,
  route_type,
  availability_mode,
  cost_label,
  detail,
  status,
  lifecycle,
  created_at,
  updated_at
)
select
  r.route_id,
  r.task_id,
  r.workspace_id,
  r.organisation_id,
  r.label,
  r.route_name,
  r.logo_path,
  r.route_type,
  r.availability_mode,
  r.cost_label,
  r.detail,
  r.route_status,
  r.route_lifecycle,
  r.created_at,
  r.created_at
from demo_routes_seed r;

insert into public.request_route_items (
  id,
  route_id,
  inventory_item_id,
  item_key,
  item_name,
  quantity
)
select
  pg_temp.demo_uuid('demo-route-item:' || r.route_id::text || ':' || r.sku),
  r.route_id,
  i.id,
  r.sku,
  i.item_name,
  r.quantity
from demo_routes_seed r
join public.inventory_items i
  on i.workspace_id = r.workspace_id
  and i.sku = r.sku
where r.support_key in ('supplies', 'food_pack')

union all

select
  pg_temp.demo_uuid('demo-route-item:' || r.route_id::text || ':' || lower(meal.meal_name) || ':' || b.diet_slug),
  r.route_id,
  i.id,
  lower(meal.meal_name) || '-' || b.diet_slug,
  i.item_name,
  r.quantity
from demo_routes_seed r
join demo_base b on b.n = r.n
cross join lateral unnest(b.meals_needed) as meal(meal_name)
join public.inventory_items i
  on i.workspace_id = r.workspace_id
  and i.sku = lower(meal.meal_name) || '-' || b.diet_slug
where r.support_key = 'cooked';

insert into public.request_route_checkpoints (
  id,
  route_id,
  stage,
  step_order,
  actor_name,
  notes,
  completed_at,
  created_at
)
select
  pg_temp.demo_uuid('demo-checkpoint:' || r.route_id::text || ':' || stage.stage),
  r.route_id,
  stage.stage::public.route_checkpoint_stage,
  stage.step_order,
  case
    when r.workspace_id = 'touch-meals-on-wheels' then 'TOUCH Meals-on-Wheels'
    when r.workspace_id = 'food-from-the-heart' then 'Food from the Heart'
    when r.workspace_id = 'temasek-distribution' then 'Temasek Foundation'
    when r.workspace_id = 'moh-art-kit-distribution' then 'Ministry of Health'
    when r.workspace_id = 'nea-dengue-outreach' then 'NEA outreach'
    else r.workspace_id
  end,
  null,
  least(r.created_at + (stage.step_order * interval '2 hours'), timestamptz '2026-06-11 08:55:00+08'),
  least(r.created_at + (stage.step_order * interval '2 hours'), timestamptz '2026-06-11 08:55:00+08')
from demo_routes_seed r
cross join lateral (
  select s.stage, s.step_order
  from (
    values
      ('accepted', 1),
      ('meal_plan_confirmed', 2),
      ('meal_preparing', 3)
  ) as s(stage, step_order)
  where r.support_key = 'cooked'

  union all

  select s.stage, s.step_order
  from (
    values
      ('accepted', 1),
      ('packing', 2),
      (r.handoff_stage, 3),
      ('completed', 4)
  ) as s(stage, step_order)
  where r.support_key <> 'cooked'
) stage
where stage.step_order <= case
  when r.route_lifecycle = 'Pending'::public.request_status then 0
  when r.route_lifecycle = 'Accepted'::public.request_status then 1
  when r.route_lifecycle = 'In progress'::public.request_status and r.support_key = 'cooked' then 2
  when r.route_lifecycle = 'In progress'::public.request_status then 2 + ((r.n + r.ordinal) % 2)
  when r.route_lifecycle = 'Completed'::public.request_status and r.support_key = 'cooked' then 3
  when r.route_lifecycle = 'Completed'::public.request_status then 4
  when r.route_lifecycle = 'Cancelled'::public.request_status and (r.n + r.ordinal) % 2 = 0 then 1
  else 0
end;

insert into public.request_status_events (
  id,
  task_id,
  from_status,
  to_status,
  reason,
  notes,
  created_at
)
select
  pg_temp.demo_uuid('demo-status-event:reroute:' || b.n::text),
  b.task_id,
  'Pending'::public.request_status,
  'Pending'::public.request_status,
  b.rejection_reason,
  'rerouted_from:' || b.original_org_id || ';rerouted_to:' || b.reroute_to_org_id,
  least(b.created_at + interval '90 minutes', timestamptz '2026-06-11 08:30:00+08')
from demo_base b
where b.was_rerouted

union all

select
  pg_temp.demo_uuid('demo-status-event:terminal:' || b.n::text),
  b.task_id,
  'Pending'::public.request_status,
  b.final_status,
  b.rejection_reason,
  case
    when b.final_status = 'Rejected'::public.request_status then 'Partner declined the request.'
    when b.final_status = 'Cancelled'::public.request_status then 'Partner cancelled after review.'
    else null
  end,
  least(b.created_at + interval '2 hours', timestamptz '2026-06-11 08:45:00+08')
from demo_base b
where b.final_status in ('Rejected'::public.request_status, 'Cancelled'::public.request_status)
  and not b.was_rerouted;

insert into public.schedule_assignments (
  id,
  task_id,
  route_id,
  workspace_id,
  assignee_name,
  scheduled_for,
  status,
  rescheduled_from,
  notes,
  created_at,
  updated_at
)
with candidates as (
  select
    b.*,
    case when b.was_rerouted then b.reroute_to_org_id else b.original_org_id end as schedule_workspace_id,
    case
      when b.support_key = 'transport' then
        ((b.created_at + interval '3 days' + (((9 + (b.n % 7))::text || ' hours')::interval) - interval '90 minutes') at time zone 'Asia/Singapore')::date
      when b.support_key = 'welfare' then
        ((b.created_at at time zone 'Asia/Singapore')::date + (1 + (b.n % 3))::integer)
      else
        ((b.created_at at time zone 'Asia/Singapore')::date + (1 + (b.n % 4))::integer)
    end as target_day
  from demo_base b
  where b.support_key in ('welfare', 'referral', 'transport')
    and (
      b.final_status = 'Completed'::public.request_status
      or (
        b.final_status = 'In progress'::public.request_status
        and b.n % 2 = 0
      )
    )
),
weekday_candidates as (
  select
    c.*,
    case extract(isodow from c.target_day)::integer
      when 6 then c.target_day + 2
      when 7 then c.target_day + 1
      else c.target_day
    end as schedule_day
  from candidates c
),
edge_weeks as (
  select
    date_trunc('week', min(created_at at time zone 'Asia/Singapore'))::date as first_seed_week,
    date_trunc('week', max(created_at at time zone 'Asia/Singapore'))::date as last_seed_week
  from demo_base
),
ranked_candidates as (
  select
    c.*,
    date_trunc('week', c.schedule_day::timestamp)::date as schedule_week,
    row_number() over (
      partition by date_trunc('week', c.schedule_day::timestamp)::date
      order by
        case c.final_status when 'In progress'::public.request_status then 0 else 1 end,
        c.schedule_day,
        c.created_at,
        c.n
    ) as schedule_week_order
  from weekday_candidates c
),
week_limited as (
  select rc.*
  from ranked_candidates rc
  cross join edge_weeks ew
  where rc.schedule_week_order <= case
    -- Edge weeks have no carry-over before the seed window, or only a partial
    -- submission window at the end, so keep them intentionally lighter.
    when rc.schedule_week = ew.first_seed_week then 36
    when rc.schedule_week = ew.last_seed_week then 36
    when rc.schedule_week > ew.last_seed_week then 4
    else 44
  end
),
ordered as (
  select
    c.*,
    row_number() over (
      partition by c.schedule_workspace_id, c.schedule_day
      order by
        case c.final_status when 'In progress'::public.request_status then 0 else 1 end,
        c.created_at,
        c.n
    ) as day_order,
    row_number() over (
      partition by c.schedule_workspace_id
      order by
        c.schedule_day,
        case c.final_status when 'In progress'::public.request_status then 0 else 1 end,
        c.created_at,
        c.n
    ) as schedule_order
  from week_limited c
),
slotted as (
  select
    o.*,
    o.schedule_day + (((o.day_order - 1) / 4)::integer) as assigned_day,
    ((o.day_order - 1) % 4)::integer as slot_index
  from ordered o
),
scheduled as (
  select
    s.*,
    (
      s.assigned_day::timestamp
      + case s.slot_index
          when 0 then interval '9 hours 30 minutes'
          when 1 then interval '11 hours'
          when 2 then interval '14 hours'
          else interval '15 hours 30 minutes'
        end
      + case
          when s.support_key = 'transport' then interval '0 minutes'
          when s.support_key = 'welfare' then ((s.n % 2) * interval '15 minutes')
          else ((s.n % 3) * interval '10 minutes')
        end
    ) at time zone 'Asia/Singapore' as scheduled_for
  from slotted s
)
select
  pg_temp.demo_uuid('demo-schedule:' || c.n::text),
  c.task_id,
  null::uuid,
  c.schedule_workspace_id,
  a.assignee_name,
  c.scheduled_for,
  case
    when c.final_status = 'Completed'::public.request_status then 'Completed'
    when c.schedule_order % 6 = 0 then 'Rescheduled'
    else 'Scheduled'
  end::public.schedule_status,
  case
    when c.final_status = 'In progress'::public.request_status and c.schedule_order % 6 = 0 then
      c.scheduled_for - interval '1 day'
    else null
  end,
  case
    when c.support_key = 'transport' then 'Confirm transport readiness before dispatch.'
    when c.support_key = 'referral' then 'Prepare care navigation notes before call.'
    else 'Confirm check-in outcome with caregiver.'
  end,
  least(c.created_at + interval '3 hours', c.scheduled_for - interval '30 minutes'),
  least(c.created_at + interval '3 hours', c.scheduled_for - interval '30 minutes')
from scheduled c
join demo_assignees a
  on a.workspace_id = c.schedule_workspace_id
  and a.assignee_order = 1 + ((c.n + c.schedule_order)::integer % 4);

update public.request_tasks t
set
  assigned_to = sa.assignee_name,
  scheduled_for = sa.scheduled_for,
  partner_notes = sa.notes
from public.schedule_assignments sa
where sa.task_id = t.id
  and t.session_id in (select session_id from demo_base);

do $$
declare
  task_record record;
  session_record record;
begin
  for task_record in
    select id
    from public.request_tasks
    where session_id in (select session_id from demo_base)
  loop
    perform public.refresh_task_status(task_record.id);
  end loop;

  for session_record in
    select id
    from public.request_sessions
    where id in (select session_id from demo_base)
  loop
    perform public.refresh_session_status(session_record.id);
  end loop;
end;
$$;

commit;

select
  count(*) as demo_sessions,
  min(created_at) as first_submission,
  max(created_at) as last_submission
from public.request_sessions
where email like 'demo.caregiver.%@orca.sg';
