-- Multiple teachers per class — a class used to have exactly one
-- `teacher_email`; now any number of teachers can share a class.
-- Run this ONCE in the Supabase Dashboard → SQL Editor.

create table class_teachers (
  teacher_email varchar(255) primary key,
  class_id integer references classes(id) not null
);

insert into class_teachers (teacher_email, class_id)
select teacher_email, id from classes;

alter table classes drop column teacher_email;

alter table class_teachers disable row level security;

-- To add another teacher to an existing class (until there's an admin UI
-- for this), run e.g.:
--   insert into class_teachers (teacher_email, class_id) values ('name@gmail.com', 1);

-- Sanity check
select ct.teacher_email, c.name, c.join_code
from class_teachers ct
join classes c on c.id = ct.class_id
order by c.id, ct.teacher_email;
