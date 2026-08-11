drop extension if exists "pg_net";

create sequence "public"."ai_rate_limits_id_seq";

create sequence "public"."classes_id_seq";

create sequence "public"."practice_sets_id_seq";

create sequence "public"."questions_id_seq";

create sequence "public"."simulation_questions_id_seq";

create sequence "public"."simulation_sentence_exercises_id_seq";


  create table "public"."admins" (
    "email" character varying(255) not null
      );


alter table "public"."admins" enable row level security;


  create table "public"."ai_rate_limits" (
    "id" bigint not null default nextval('public.ai_rate_limits_id_seq'::regclass),
    "student_id" uuid not null,
    "endpoint" text not null,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."ai_rate_limits" enable row level security;


  create table "public"."ai_reading_results" (
    "id" uuid not null default gen_random_uuid(),
    "student_id" uuid not null,
    "class_id" integer,
    "level" smallint not null,
    "is_correct" boolean not null,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."ai_reading_results" enable row level security;


  create table "public"."ai_sentence_results" (
    "id" uuid not null default gen_random_uuid(),
    "student_id" uuid not null,
    "class_id" integer,
    "level" smallint not null,
    "score" smallint not null,
    "created_at" timestamp with time zone not null default now(),
    "sentence_text" text,
    "feedback" jsonb,
    "word_list" jsonb
      );


alter table "public"."ai_sentence_results" enable row level security;


  create table "public"."class_teachers" (
    "teacher_email" character varying(255) not null,
    "class_id" integer not null,
    "lesson_group" smallint
      );


alter table "public"."class_teachers" enable row level security;


  create table "public"."classes" (
    "id" integer not null default nextval('public.classes_id_seq'::regclass),
    "name" character varying(50) not null,
    "join_code" text not null,
    "has_lesson_groups" boolean not null default false
      );


alter table "public"."classes" enable row level security;


  create table "public"."interview_practice_answers" (
    "id" uuid not null default gen_random_uuid(),
    "student_id" uuid not null,
    "class_id" integer,
    "question_id" integer not null,
    "answer_text" text not null,
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."interview_practice_answers" enable row level security;


  create table "public"."interview_results" (
    "id" uuid not null default gen_random_uuid(),
    "student_id" uuid,
    "score" integer not null,
    "level" text,
    "submitted_at" timestamp with time zone default now()
      );


alter table "public"."interview_results" enable row level security;


  create table "public"."makbatzim_results" (
    "id" uuid not null default gen_random_uuid(),
    "student_id" uuid not null,
    "class_id" integer,
    "set_id" text not null,
    "question_id" integer not null,
    "selected_option" integer not null,
    "is_correct" boolean not null,
    "answered_at" timestamp with time zone not null default now()
      );


alter table "public"."makbatzim_results" enable row level security;


  create table "public"."practice_sets" (
    "id" integer not null default nextval('public.practice_sets_id_seq'::regclass),
    "set_number" integer not null,
    "topic" character varying(255) not null,
    "difficulty_level" integer not null,
    "created_at" timestamp with time zone default now()
      );


alter table "public"."practice_sets" enable row level security;


  create table "public"."questions" (
    "id" integer not null default nextval('public.questions_id_seq'::regclass),
    "practice_set_id" integer,
    "question_text" text not null,
    "answer_option_1" text not null,
    "answer_option_2" text not null,
    "answer_option_3" text not null,
    "answer_option_4" text not null,
    "correct_answer_number" integer not null,
    "question_order" integer not null
      );


alter table "public"."questions" enable row level security;


  create table "public"."sentence_results" (
    "id" uuid not null default gen_random_uuid(),
    "student_id" uuid,
    "set_id" integer not null,
    "exercise_idx" integer not null,
    "score" integer not null,
    "submitted_at" timestamp with time zone default now(),
    "sentence_text" text,
    "feedback" jsonb
      );


alter table "public"."sentence_results" enable row level security;


  create table "public"."simulation_interview_results" (
    "id" uuid not null default gen_random_uuid(),
    "session_id" uuid,
    "score" integer,
    "level" text,
    "summary" text
      );


alter table "public"."simulation_interview_results" enable row level security;


  create table "public"."simulation_questions" (
    "id" integer not null default nextval('public.simulation_questions_id_seq'::regclass),
    "part" smallint not null,
    "q_order" smallint not null,
    "passage_text" text not null,
    "question_text" text not null,
    "option_1" text not null,
    "option_2" text not null,
    "option_3" text not null,
    "option_4" text not null,
    "correct_answer" smallint not null
      );


alter table "public"."simulation_questions" enable row level security;


  create table "public"."simulation_reading_answers" (
    "id" uuid not null default gen_random_uuid(),
    "session_id" uuid,
    "question_id" integer,
    "selected_answer" smallint,
    "is_correct" boolean
      );


alter table "public"."simulation_reading_answers" enable row level security;


  create table "public"."simulation_sentence_exercises" (
    "id" integer not null default nextval('public.simulation_sentence_exercises_id_seq'::regclass),
    "ex_order" smallint not null,
    "words_json" jsonb not null
      );


alter table "public"."simulation_sentence_exercises" enable row level security;


  create table "public"."simulation_sentence_results" (
    "id" uuid not null default gen_random_uuid(),
    "session_id" uuid,
    "ex_order" smallint,
    "sentence" text,
    "score" smallint,
    "feedback" text,
    "improved_sentence" text
      );


alter table "public"."simulation_sentence_results" enable row level security;


  create table "public"."simulation_sessions" (
    "id" uuid not null default gen_random_uuid(),
    "student_id" uuid,
    "class_id" integer,
    "status" text default 'in_progress'::text,
    "started_at" timestamp with time zone default now(),
    "completed_at" timestamp with time zone,
    "part_a_correct" integer,
    "part_a_total" integer default 16,
    "part_b_correct" integer,
    "part_b_total" integer default 24,
    "part_c_avg_score" numeric(5,2),
    "part_d_score" integer,
    "part_d_level" text
      );


alter table "public"."simulation_sessions" enable row level security;


  create table "public"."student_answers" (
    "id" uuid not null default gen_random_uuid(),
    "submission_id" uuid,
    "question_id" integer,
    "selected_answer_number" integer,
    "is_correct" boolean
      );


alter table "public"."student_answers" enable row level security;


  create table "public"."students" (
    "id" uuid not null default gen_random_uuid(),
    "full_name" character varying(255) not null,
    "class_id" integer,
    "created_at" timestamp with time zone default now(),
    "auth_user_id" uuid,
    "lesson_group" smallint
      );


alter table "public"."students" enable row level security;


  create table "public"."submissions" (
    "id" uuid not null default gen_random_uuid(),
    "student_id" uuid,
    "practice_set_id" integer,
    "score_percentage" numeric(5,2),
    "correct_count" integer,
    "total_questions" integer,
    "submitted_at" timestamp with time zone default now()
      );


alter table "public"."submissions" enable row level security;


  create table "public"."tzav_rishon_results" (
    "id" uuid not null default gen_random_uuid(),
    "student_id" uuid not null,
    "class_id" integer,
    "topic" text not null,
    "question_id" integer not null,
    "selected_option" integer not null,
    "is_correct" boolean not null,
    "answered_at" timestamp with time zone not null default now()
      );


alter table "public"."tzav_rishon_results" enable row level security;

alter sequence "public"."ai_rate_limits_id_seq" owned by "public"."ai_rate_limits"."id";

alter sequence "public"."classes_id_seq" owned by "public"."classes"."id";

alter sequence "public"."practice_sets_id_seq" owned by "public"."practice_sets"."id";

alter sequence "public"."questions_id_seq" owned by "public"."questions"."id";

alter sequence "public"."simulation_questions_id_seq" owned by "public"."simulation_questions"."id";

alter sequence "public"."simulation_sentence_exercises_id_seq" owned by "public"."simulation_sentence_exercises"."id";

CREATE UNIQUE INDEX admins_pkey ON public.admins USING btree (email);

CREATE UNIQUE INDEX ai_rate_limits_pkey ON public.ai_rate_limits USING btree (id);

CREATE INDEX ai_rate_limits_student_created_idx ON public.ai_rate_limits USING btree (student_id, created_at);

CREATE UNIQUE INDEX ai_reading_results_pkey ON public.ai_reading_results USING btree (id);

CREATE UNIQUE INDEX ai_sentence_results_pkey ON public.ai_sentence_results USING btree (id);

CREATE UNIQUE INDEX class_teachers_pkey ON public.class_teachers USING btree (teacher_email, class_id);

CREATE UNIQUE INDEX classes_join_code_unique ON public.classes USING btree (join_code);

CREATE UNIQUE INDEX classes_pkey ON public.classes USING btree (id);

CREATE UNIQUE INDEX interview_practice_answers_pkey ON public.interview_practice_answers USING btree (id);

CREATE UNIQUE INDEX interview_practice_answers_student_id_question_id_key ON public.interview_practice_answers USING btree (student_id, question_id);

CREATE UNIQUE INDEX interview_results_pkey ON public.interview_results USING btree (id);

CREATE UNIQUE INDEX makbatzim_results_pkey ON public.makbatzim_results USING btree (id);

CREATE UNIQUE INDEX makbatzim_results_student_id_set_id_question_id_key ON public.makbatzim_results USING btree (student_id, set_id, question_id);

CREATE UNIQUE INDEX practice_sets_pkey ON public.practice_sets USING btree (id);

CREATE UNIQUE INDEX questions_pkey ON public.questions USING btree (id);

CREATE UNIQUE INDEX sentence_results_pkey ON public.sentence_results USING btree (id);

CREATE UNIQUE INDEX simulation_interview_results_pkey ON public.simulation_interview_results USING btree (id);

CREATE UNIQUE INDEX simulation_questions_pkey ON public.simulation_questions USING btree (id);

CREATE UNIQUE INDEX simulation_reading_answers_pkey ON public.simulation_reading_answers USING btree (id);

CREATE UNIQUE INDEX simulation_sentence_exercises_pkey ON public.simulation_sentence_exercises USING btree (id);

CREATE UNIQUE INDEX simulation_sentence_results_pkey ON public.simulation_sentence_results USING btree (id);

CREATE UNIQUE INDEX simulation_sessions_pkey ON public.simulation_sessions USING btree (id);

CREATE UNIQUE INDEX student_answers_pkey ON public.student_answers USING btree (id);

CREATE UNIQUE INDEX students_auth_user_id_unique ON public.students USING btree (auth_user_id);

CREATE UNIQUE INDEX students_pkey ON public.students USING btree (id);

CREATE UNIQUE INDEX submissions_pkey ON public.submissions USING btree (id);

CREATE UNIQUE INDEX submissions_student_id_practice_set_id_key ON public.submissions USING btree (student_id, practice_set_id);

CREATE UNIQUE INDEX tzav_rishon_results_pkey ON public.tzav_rishon_results USING btree (id);

CREATE UNIQUE INDEX tzav_rishon_results_student_id_topic_question_id_key ON public.tzav_rishon_results USING btree (student_id, topic, question_id);

alter table "public"."admins" add constraint "admins_pkey" PRIMARY KEY using index "admins_pkey";

alter table "public"."ai_rate_limits" add constraint "ai_rate_limits_pkey" PRIMARY KEY using index "ai_rate_limits_pkey";

alter table "public"."ai_reading_results" add constraint "ai_reading_results_pkey" PRIMARY KEY using index "ai_reading_results_pkey";

alter table "public"."ai_sentence_results" add constraint "ai_sentence_results_pkey" PRIMARY KEY using index "ai_sentence_results_pkey";

alter table "public"."class_teachers" add constraint "class_teachers_pkey" PRIMARY KEY using index "class_teachers_pkey";

alter table "public"."classes" add constraint "classes_pkey" PRIMARY KEY using index "classes_pkey";

alter table "public"."interview_practice_answers" add constraint "interview_practice_answers_pkey" PRIMARY KEY using index "interview_practice_answers_pkey";

alter table "public"."interview_results" add constraint "interview_results_pkey" PRIMARY KEY using index "interview_results_pkey";

alter table "public"."makbatzim_results" add constraint "makbatzim_results_pkey" PRIMARY KEY using index "makbatzim_results_pkey";

alter table "public"."practice_sets" add constraint "practice_sets_pkey" PRIMARY KEY using index "practice_sets_pkey";

alter table "public"."questions" add constraint "questions_pkey" PRIMARY KEY using index "questions_pkey";

alter table "public"."sentence_results" add constraint "sentence_results_pkey" PRIMARY KEY using index "sentence_results_pkey";

alter table "public"."simulation_interview_results" add constraint "simulation_interview_results_pkey" PRIMARY KEY using index "simulation_interview_results_pkey";

alter table "public"."simulation_questions" add constraint "simulation_questions_pkey" PRIMARY KEY using index "simulation_questions_pkey";

alter table "public"."simulation_reading_answers" add constraint "simulation_reading_answers_pkey" PRIMARY KEY using index "simulation_reading_answers_pkey";

alter table "public"."simulation_sentence_exercises" add constraint "simulation_sentence_exercises_pkey" PRIMARY KEY using index "simulation_sentence_exercises_pkey";

alter table "public"."simulation_sentence_results" add constraint "simulation_sentence_results_pkey" PRIMARY KEY using index "simulation_sentence_results_pkey";

alter table "public"."simulation_sessions" add constraint "simulation_sessions_pkey" PRIMARY KEY using index "simulation_sessions_pkey";

alter table "public"."student_answers" add constraint "student_answers_pkey" PRIMARY KEY using index "student_answers_pkey";

alter table "public"."students" add constraint "students_pkey" PRIMARY KEY using index "students_pkey";

alter table "public"."submissions" add constraint "submissions_pkey" PRIMARY KEY using index "submissions_pkey";

alter table "public"."tzav_rishon_results" add constraint "tzav_rishon_results_pkey" PRIMARY KEY using index "tzav_rishon_results_pkey";

alter table "public"."ai_reading_results" add constraint "ai_reading_results_class_id_fkey" FOREIGN KEY (class_id) REFERENCES public.classes(id) not valid;

alter table "public"."ai_reading_results" validate constraint "ai_reading_results_class_id_fkey";

alter table "public"."ai_reading_results" add constraint "ai_reading_results_level_check" CHECK (((level >= 1) AND (level <= 5))) not valid;

alter table "public"."ai_reading_results" validate constraint "ai_reading_results_level_check";

alter table "public"."ai_reading_results" add constraint "ai_reading_results_student_id_fkey" FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE not valid;

alter table "public"."ai_reading_results" validate constraint "ai_reading_results_student_id_fkey";

alter table "public"."ai_sentence_results" add constraint "ai_sentence_results_class_id_fkey" FOREIGN KEY (class_id) REFERENCES public.classes(id) not valid;

alter table "public"."ai_sentence_results" validate constraint "ai_sentence_results_class_id_fkey";

alter table "public"."ai_sentence_results" add constraint "ai_sentence_results_level_check" CHECK (((level >= 1) AND (level <= 5))) not valid;

alter table "public"."ai_sentence_results" validate constraint "ai_sentence_results_level_check";

alter table "public"."ai_sentence_results" add constraint "ai_sentence_results_score_check" CHECK (((score >= 0) AND (score <= 10))) not valid;

alter table "public"."ai_sentence_results" validate constraint "ai_sentence_results_score_check";

alter table "public"."ai_sentence_results" add constraint "ai_sentence_results_student_id_fkey" FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE not valid;

alter table "public"."ai_sentence_results" validate constraint "ai_sentence_results_student_id_fkey";

alter table "public"."class_teachers" add constraint "class_teachers_class_id_fkey" FOREIGN KEY (class_id) REFERENCES public.classes(id) not valid;

alter table "public"."class_teachers" validate constraint "class_teachers_class_id_fkey";

alter table "public"."class_teachers" add constraint "class_teachers_lesson_group_check" CHECK ((lesson_group = ANY (ARRAY[1, 2, 3]))) not valid;

alter table "public"."class_teachers" validate constraint "class_teachers_lesson_group_check";

alter table "public"."classes" add constraint "classes_join_code_unique" UNIQUE using index "classes_join_code_unique";

alter table "public"."interview_practice_answers" add constraint "interview_practice_answers_class_id_fkey" FOREIGN KEY (class_id) REFERENCES public.classes(id) not valid;

alter table "public"."interview_practice_answers" validate constraint "interview_practice_answers_class_id_fkey";

alter table "public"."interview_practice_answers" add constraint "interview_practice_answers_student_id_fkey" FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE not valid;

alter table "public"."interview_practice_answers" validate constraint "interview_practice_answers_student_id_fkey";

alter table "public"."interview_practice_answers" add constraint "interview_practice_answers_student_id_question_id_key" UNIQUE using index "interview_practice_answers_student_id_question_id_key";

alter table "public"."interview_results" add constraint "interview_results_student_id_fkey" FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE not valid;

alter table "public"."interview_results" validate constraint "interview_results_student_id_fkey";

alter table "public"."makbatzim_results" add constraint "makbatzim_results_class_id_fkey" FOREIGN KEY (class_id) REFERENCES public.classes(id) not valid;

alter table "public"."makbatzim_results" validate constraint "makbatzim_results_class_id_fkey";

alter table "public"."makbatzim_results" add constraint "makbatzim_results_student_id_fkey" FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE not valid;

alter table "public"."makbatzim_results" validate constraint "makbatzim_results_student_id_fkey";

alter table "public"."makbatzim_results" add constraint "makbatzim_results_student_id_set_id_question_id_key" UNIQUE using index "makbatzim_results_student_id_set_id_question_id_key";

alter table "public"."questions" add constraint "questions_correct_answer_number_check" CHECK ((correct_answer_number = ANY (ARRAY[1, 2, 3, 4]))) not valid;

alter table "public"."questions" validate constraint "questions_correct_answer_number_check";

alter table "public"."questions" add constraint "questions_practice_set_id_fkey" FOREIGN KEY (practice_set_id) REFERENCES public.practice_sets(id) ON DELETE CASCADE not valid;

alter table "public"."questions" validate constraint "questions_practice_set_id_fkey";

alter table "public"."sentence_results" add constraint "sentence_results_student_id_fkey" FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE not valid;

alter table "public"."sentence_results" validate constraint "sentence_results_student_id_fkey";

alter table "public"."simulation_interview_results" add constraint "simulation_interview_results_session_id_fkey" FOREIGN KEY (session_id) REFERENCES public.simulation_sessions(id) ON DELETE CASCADE not valid;

alter table "public"."simulation_interview_results" validate constraint "simulation_interview_results_session_id_fkey";

alter table "public"."simulation_reading_answers" add constraint "simulation_reading_answers_question_id_fkey" FOREIGN KEY (question_id) REFERENCES public.simulation_questions(id) not valid;

alter table "public"."simulation_reading_answers" validate constraint "simulation_reading_answers_question_id_fkey";

alter table "public"."simulation_reading_answers" add constraint "simulation_reading_answers_session_id_fkey" FOREIGN KEY (session_id) REFERENCES public.simulation_sessions(id) ON DELETE CASCADE not valid;

alter table "public"."simulation_reading_answers" validate constraint "simulation_reading_answers_session_id_fkey";

alter table "public"."simulation_sentence_results" add constraint "simulation_sentence_results_session_id_fkey" FOREIGN KEY (session_id) REFERENCES public.simulation_sessions(id) ON DELETE CASCADE not valid;

alter table "public"."simulation_sentence_results" validate constraint "simulation_sentence_results_session_id_fkey";

alter table "public"."simulation_sessions" add constraint "simulation_sessions_class_id_fkey" FOREIGN KEY (class_id) REFERENCES public.classes(id) not valid;

alter table "public"."simulation_sessions" validate constraint "simulation_sessions_class_id_fkey";

alter table "public"."simulation_sessions" add constraint "simulation_sessions_student_id_fkey" FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE not valid;

alter table "public"."simulation_sessions" validate constraint "simulation_sessions_student_id_fkey";

alter table "public"."student_answers" add constraint "student_answers_question_id_fkey" FOREIGN KEY (question_id) REFERENCES public.questions(id) not valid;

alter table "public"."student_answers" validate constraint "student_answers_question_id_fkey";

alter table "public"."student_answers" add constraint "student_answers_submission_id_fkey" FOREIGN KEY (submission_id) REFERENCES public.submissions(id) ON DELETE CASCADE not valid;

alter table "public"."student_answers" validate constraint "student_answers_submission_id_fkey";

alter table "public"."students" add constraint "students_auth_user_id_fkey" FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) not valid;

alter table "public"."students" validate constraint "students_auth_user_id_fkey";

alter table "public"."students" add constraint "students_auth_user_id_unique" UNIQUE using index "students_auth_user_id_unique";

alter table "public"."students" add constraint "students_class_id_fkey" FOREIGN KEY (class_id) REFERENCES public.classes(id) not valid;

alter table "public"."students" validate constraint "students_class_id_fkey";

alter table "public"."students" add constraint "students_lesson_group_check" CHECK ((lesson_group = ANY (ARRAY[1, 2, 3]))) not valid;

alter table "public"."students" validate constraint "students_lesson_group_check";

alter table "public"."submissions" add constraint "submissions_practice_set_id_fkey" FOREIGN KEY (practice_set_id) REFERENCES public.practice_sets(id) not valid;

alter table "public"."submissions" validate constraint "submissions_practice_set_id_fkey";

alter table "public"."submissions" add constraint "submissions_student_id_fkey" FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE not valid;

alter table "public"."submissions" validate constraint "submissions_student_id_fkey";

alter table "public"."submissions" add constraint "submissions_student_id_practice_set_id_key" UNIQUE using index "submissions_student_id_practice_set_id_key";

alter table "public"."tzav_rishon_results" add constraint "tzav_rishon_results_class_id_fkey" FOREIGN KEY (class_id) REFERENCES public.classes(id) not valid;

alter table "public"."tzav_rishon_results" validate constraint "tzav_rishon_results_class_id_fkey";

alter table "public"."tzav_rishon_results" add constraint "tzav_rishon_results_student_id_fkey" FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE not valid;

alter table "public"."tzav_rishon_results" validate constraint "tzav_rishon_results_student_id_fkey";

alter table "public"."tzav_rishon_results" add constraint "tzav_rishon_results_student_id_topic_question_id_key" UNIQUE using index "tzav_rishon_results_student_id_topic_question_id_key";

grant delete on table "public"."admins" to "anon";

grant insert on table "public"."admins" to "anon";

grant references on table "public"."admins" to "anon";

grant select on table "public"."admins" to "anon";

grant trigger on table "public"."admins" to "anon";

grant truncate on table "public"."admins" to "anon";

grant update on table "public"."admins" to "anon";

grant delete on table "public"."admins" to "authenticated";

grant insert on table "public"."admins" to "authenticated";

grant references on table "public"."admins" to "authenticated";

grant select on table "public"."admins" to "authenticated";

grant trigger on table "public"."admins" to "authenticated";

grant truncate on table "public"."admins" to "authenticated";

grant update on table "public"."admins" to "authenticated";

grant delete on table "public"."admins" to "service_role";

grant insert on table "public"."admins" to "service_role";

grant references on table "public"."admins" to "service_role";

grant select on table "public"."admins" to "service_role";

grant trigger on table "public"."admins" to "service_role";

grant truncate on table "public"."admins" to "service_role";

grant update on table "public"."admins" to "service_role";

grant delete on table "public"."ai_rate_limits" to "anon";

grant insert on table "public"."ai_rate_limits" to "anon";

grant references on table "public"."ai_rate_limits" to "anon";

grant select on table "public"."ai_rate_limits" to "anon";

grant trigger on table "public"."ai_rate_limits" to "anon";

grant truncate on table "public"."ai_rate_limits" to "anon";

grant update on table "public"."ai_rate_limits" to "anon";

grant delete on table "public"."ai_rate_limits" to "authenticated";

grant insert on table "public"."ai_rate_limits" to "authenticated";

grant references on table "public"."ai_rate_limits" to "authenticated";

grant select on table "public"."ai_rate_limits" to "authenticated";

grant trigger on table "public"."ai_rate_limits" to "authenticated";

grant truncate on table "public"."ai_rate_limits" to "authenticated";

grant update on table "public"."ai_rate_limits" to "authenticated";

grant delete on table "public"."ai_rate_limits" to "service_role";

grant insert on table "public"."ai_rate_limits" to "service_role";

grant references on table "public"."ai_rate_limits" to "service_role";

grant select on table "public"."ai_rate_limits" to "service_role";

grant trigger on table "public"."ai_rate_limits" to "service_role";

grant truncate on table "public"."ai_rate_limits" to "service_role";

grant update on table "public"."ai_rate_limits" to "service_role";

grant delete on table "public"."ai_reading_results" to "anon";

grant insert on table "public"."ai_reading_results" to "anon";

grant references on table "public"."ai_reading_results" to "anon";

grant select on table "public"."ai_reading_results" to "anon";

grant trigger on table "public"."ai_reading_results" to "anon";

grant truncate on table "public"."ai_reading_results" to "anon";

grant update on table "public"."ai_reading_results" to "anon";

grant delete on table "public"."ai_reading_results" to "authenticated";

grant insert on table "public"."ai_reading_results" to "authenticated";

grant references on table "public"."ai_reading_results" to "authenticated";

grant select on table "public"."ai_reading_results" to "authenticated";

grant trigger on table "public"."ai_reading_results" to "authenticated";

grant truncate on table "public"."ai_reading_results" to "authenticated";

grant update on table "public"."ai_reading_results" to "authenticated";

grant delete on table "public"."ai_reading_results" to "service_role";

grant insert on table "public"."ai_reading_results" to "service_role";

grant references on table "public"."ai_reading_results" to "service_role";

grant select on table "public"."ai_reading_results" to "service_role";

grant trigger on table "public"."ai_reading_results" to "service_role";

grant truncate on table "public"."ai_reading_results" to "service_role";

grant update on table "public"."ai_reading_results" to "service_role";

grant delete on table "public"."ai_sentence_results" to "anon";

grant insert on table "public"."ai_sentence_results" to "anon";

grant references on table "public"."ai_sentence_results" to "anon";

grant select on table "public"."ai_sentence_results" to "anon";

grant trigger on table "public"."ai_sentence_results" to "anon";

grant truncate on table "public"."ai_sentence_results" to "anon";

grant update on table "public"."ai_sentence_results" to "anon";

grant delete on table "public"."ai_sentence_results" to "authenticated";

grant insert on table "public"."ai_sentence_results" to "authenticated";

grant references on table "public"."ai_sentence_results" to "authenticated";

grant select on table "public"."ai_sentence_results" to "authenticated";

grant trigger on table "public"."ai_sentence_results" to "authenticated";

grant truncate on table "public"."ai_sentence_results" to "authenticated";

grant update on table "public"."ai_sentence_results" to "authenticated";

grant delete on table "public"."ai_sentence_results" to "service_role";

grant insert on table "public"."ai_sentence_results" to "service_role";

grant references on table "public"."ai_sentence_results" to "service_role";

grant select on table "public"."ai_sentence_results" to "service_role";

grant trigger on table "public"."ai_sentence_results" to "service_role";

grant truncate on table "public"."ai_sentence_results" to "service_role";

grant update on table "public"."ai_sentence_results" to "service_role";

grant delete on table "public"."class_teachers" to "anon";

grant insert on table "public"."class_teachers" to "anon";

grant references on table "public"."class_teachers" to "anon";

grant select on table "public"."class_teachers" to "anon";

grant trigger on table "public"."class_teachers" to "anon";

grant truncate on table "public"."class_teachers" to "anon";

grant update on table "public"."class_teachers" to "anon";

grant delete on table "public"."class_teachers" to "authenticated";

grant insert on table "public"."class_teachers" to "authenticated";

grant references on table "public"."class_teachers" to "authenticated";

grant select on table "public"."class_teachers" to "authenticated";

grant trigger on table "public"."class_teachers" to "authenticated";

grant truncate on table "public"."class_teachers" to "authenticated";

grant update on table "public"."class_teachers" to "authenticated";

grant delete on table "public"."class_teachers" to "service_role";

grant insert on table "public"."class_teachers" to "service_role";

grant references on table "public"."class_teachers" to "service_role";

grant select on table "public"."class_teachers" to "service_role";

grant trigger on table "public"."class_teachers" to "service_role";

grant truncate on table "public"."class_teachers" to "service_role";

grant update on table "public"."class_teachers" to "service_role";

grant delete on table "public"."classes" to "anon";

grant insert on table "public"."classes" to "anon";

grant references on table "public"."classes" to "anon";

grant select on table "public"."classes" to "anon";

grant trigger on table "public"."classes" to "anon";

grant truncate on table "public"."classes" to "anon";

grant update on table "public"."classes" to "anon";

grant delete on table "public"."classes" to "authenticated";

grant insert on table "public"."classes" to "authenticated";

grant references on table "public"."classes" to "authenticated";

grant select on table "public"."classes" to "authenticated";

grant trigger on table "public"."classes" to "authenticated";

grant truncate on table "public"."classes" to "authenticated";

grant update on table "public"."classes" to "authenticated";

grant delete on table "public"."classes" to "service_role";

grant insert on table "public"."classes" to "service_role";

grant references on table "public"."classes" to "service_role";

grant select on table "public"."classes" to "service_role";

grant trigger on table "public"."classes" to "service_role";

grant truncate on table "public"."classes" to "service_role";

grant update on table "public"."classes" to "service_role";

grant delete on table "public"."interview_practice_answers" to "anon";

grant insert on table "public"."interview_practice_answers" to "anon";

grant references on table "public"."interview_practice_answers" to "anon";

grant select on table "public"."interview_practice_answers" to "anon";

grant trigger on table "public"."interview_practice_answers" to "anon";

grant truncate on table "public"."interview_practice_answers" to "anon";

grant update on table "public"."interview_practice_answers" to "anon";

grant delete on table "public"."interview_practice_answers" to "authenticated";

grant insert on table "public"."interview_practice_answers" to "authenticated";

grant references on table "public"."interview_practice_answers" to "authenticated";

grant select on table "public"."interview_practice_answers" to "authenticated";

grant trigger on table "public"."interview_practice_answers" to "authenticated";

grant truncate on table "public"."interview_practice_answers" to "authenticated";

grant update on table "public"."interview_practice_answers" to "authenticated";

grant delete on table "public"."interview_practice_answers" to "service_role";

grant insert on table "public"."interview_practice_answers" to "service_role";

grant references on table "public"."interview_practice_answers" to "service_role";

grant select on table "public"."interview_practice_answers" to "service_role";

grant trigger on table "public"."interview_practice_answers" to "service_role";

grant truncate on table "public"."interview_practice_answers" to "service_role";

grant update on table "public"."interview_practice_answers" to "service_role";

grant delete on table "public"."interview_results" to "anon";

grant insert on table "public"."interview_results" to "anon";

grant references on table "public"."interview_results" to "anon";

grant select on table "public"."interview_results" to "anon";

grant trigger on table "public"."interview_results" to "anon";

grant truncate on table "public"."interview_results" to "anon";

grant update on table "public"."interview_results" to "anon";

grant delete on table "public"."interview_results" to "authenticated";

grant insert on table "public"."interview_results" to "authenticated";

grant references on table "public"."interview_results" to "authenticated";

grant select on table "public"."interview_results" to "authenticated";

grant trigger on table "public"."interview_results" to "authenticated";

grant truncate on table "public"."interview_results" to "authenticated";

grant update on table "public"."interview_results" to "authenticated";

grant delete on table "public"."interview_results" to "service_role";

grant insert on table "public"."interview_results" to "service_role";

grant references on table "public"."interview_results" to "service_role";

grant select on table "public"."interview_results" to "service_role";

grant trigger on table "public"."interview_results" to "service_role";

grant truncate on table "public"."interview_results" to "service_role";

grant update on table "public"."interview_results" to "service_role";

grant delete on table "public"."makbatzim_results" to "anon";

grant insert on table "public"."makbatzim_results" to "anon";

grant references on table "public"."makbatzim_results" to "anon";

grant select on table "public"."makbatzim_results" to "anon";

grant trigger on table "public"."makbatzim_results" to "anon";

grant truncate on table "public"."makbatzim_results" to "anon";

grant update on table "public"."makbatzim_results" to "anon";

grant delete on table "public"."makbatzim_results" to "authenticated";

grant insert on table "public"."makbatzim_results" to "authenticated";

grant references on table "public"."makbatzim_results" to "authenticated";

grant select on table "public"."makbatzim_results" to "authenticated";

grant trigger on table "public"."makbatzim_results" to "authenticated";

grant truncate on table "public"."makbatzim_results" to "authenticated";

grant update on table "public"."makbatzim_results" to "authenticated";

grant delete on table "public"."makbatzim_results" to "service_role";

grant insert on table "public"."makbatzim_results" to "service_role";

grant references on table "public"."makbatzim_results" to "service_role";

grant select on table "public"."makbatzim_results" to "service_role";

grant trigger on table "public"."makbatzim_results" to "service_role";

grant truncate on table "public"."makbatzim_results" to "service_role";

grant update on table "public"."makbatzim_results" to "service_role";

grant delete on table "public"."practice_sets" to "anon";

grant insert on table "public"."practice_sets" to "anon";

grant references on table "public"."practice_sets" to "anon";

grant select on table "public"."practice_sets" to "anon";

grant trigger on table "public"."practice_sets" to "anon";

grant truncate on table "public"."practice_sets" to "anon";

grant update on table "public"."practice_sets" to "anon";

grant delete on table "public"."practice_sets" to "authenticated";

grant insert on table "public"."practice_sets" to "authenticated";

grant references on table "public"."practice_sets" to "authenticated";

grant select on table "public"."practice_sets" to "authenticated";

grant trigger on table "public"."practice_sets" to "authenticated";

grant truncate on table "public"."practice_sets" to "authenticated";

grant update on table "public"."practice_sets" to "authenticated";

grant delete on table "public"."practice_sets" to "service_role";

grant insert on table "public"."practice_sets" to "service_role";

grant references on table "public"."practice_sets" to "service_role";

grant select on table "public"."practice_sets" to "service_role";

grant trigger on table "public"."practice_sets" to "service_role";

grant truncate on table "public"."practice_sets" to "service_role";

grant update on table "public"."practice_sets" to "service_role";

grant delete on table "public"."questions" to "anon";

grant insert on table "public"."questions" to "anon";

grant references on table "public"."questions" to "anon";

grant select on table "public"."questions" to "anon";

grant trigger on table "public"."questions" to "anon";

grant truncate on table "public"."questions" to "anon";

grant update on table "public"."questions" to "anon";

grant delete on table "public"."questions" to "authenticated";

grant insert on table "public"."questions" to "authenticated";

grant references on table "public"."questions" to "authenticated";

grant select on table "public"."questions" to "authenticated";

grant trigger on table "public"."questions" to "authenticated";

grant truncate on table "public"."questions" to "authenticated";

grant update on table "public"."questions" to "authenticated";

grant delete on table "public"."questions" to "service_role";

grant insert on table "public"."questions" to "service_role";

grant references on table "public"."questions" to "service_role";

grant select on table "public"."questions" to "service_role";

grant trigger on table "public"."questions" to "service_role";

grant truncate on table "public"."questions" to "service_role";

grant update on table "public"."questions" to "service_role";

grant delete on table "public"."sentence_results" to "anon";

grant insert on table "public"."sentence_results" to "anon";

grant references on table "public"."sentence_results" to "anon";

grant select on table "public"."sentence_results" to "anon";

grant trigger on table "public"."sentence_results" to "anon";

grant truncate on table "public"."sentence_results" to "anon";

grant update on table "public"."sentence_results" to "anon";

grant delete on table "public"."sentence_results" to "authenticated";

grant insert on table "public"."sentence_results" to "authenticated";

grant references on table "public"."sentence_results" to "authenticated";

grant select on table "public"."sentence_results" to "authenticated";

grant trigger on table "public"."sentence_results" to "authenticated";

grant truncate on table "public"."sentence_results" to "authenticated";

grant update on table "public"."sentence_results" to "authenticated";

grant delete on table "public"."sentence_results" to "service_role";

grant insert on table "public"."sentence_results" to "service_role";

grant references on table "public"."sentence_results" to "service_role";

grant select on table "public"."sentence_results" to "service_role";

grant trigger on table "public"."sentence_results" to "service_role";

grant truncate on table "public"."sentence_results" to "service_role";

grant update on table "public"."sentence_results" to "service_role";

grant delete on table "public"."simulation_interview_results" to "anon";

grant insert on table "public"."simulation_interview_results" to "anon";

grant references on table "public"."simulation_interview_results" to "anon";

grant select on table "public"."simulation_interview_results" to "anon";

grant trigger on table "public"."simulation_interview_results" to "anon";

grant truncate on table "public"."simulation_interview_results" to "anon";

grant update on table "public"."simulation_interview_results" to "anon";

grant delete on table "public"."simulation_interview_results" to "authenticated";

grant insert on table "public"."simulation_interview_results" to "authenticated";

grant references on table "public"."simulation_interview_results" to "authenticated";

grant select on table "public"."simulation_interview_results" to "authenticated";

grant trigger on table "public"."simulation_interview_results" to "authenticated";

grant truncate on table "public"."simulation_interview_results" to "authenticated";

grant update on table "public"."simulation_interview_results" to "authenticated";

grant delete on table "public"."simulation_interview_results" to "service_role";

grant insert on table "public"."simulation_interview_results" to "service_role";

grant references on table "public"."simulation_interview_results" to "service_role";

grant select on table "public"."simulation_interview_results" to "service_role";

grant trigger on table "public"."simulation_interview_results" to "service_role";

grant truncate on table "public"."simulation_interview_results" to "service_role";

grant update on table "public"."simulation_interview_results" to "service_role";

grant delete on table "public"."simulation_questions" to "anon";

grant insert on table "public"."simulation_questions" to "anon";

grant references on table "public"."simulation_questions" to "anon";

grant select on table "public"."simulation_questions" to "anon";

grant trigger on table "public"."simulation_questions" to "anon";

grant truncate on table "public"."simulation_questions" to "anon";

grant update on table "public"."simulation_questions" to "anon";

grant delete on table "public"."simulation_questions" to "authenticated";

grant insert on table "public"."simulation_questions" to "authenticated";

grant references on table "public"."simulation_questions" to "authenticated";

grant select on table "public"."simulation_questions" to "authenticated";

grant trigger on table "public"."simulation_questions" to "authenticated";

grant truncate on table "public"."simulation_questions" to "authenticated";

grant update on table "public"."simulation_questions" to "authenticated";

grant delete on table "public"."simulation_questions" to "service_role";

grant insert on table "public"."simulation_questions" to "service_role";

grant references on table "public"."simulation_questions" to "service_role";

grant select on table "public"."simulation_questions" to "service_role";

grant trigger on table "public"."simulation_questions" to "service_role";

grant truncate on table "public"."simulation_questions" to "service_role";

grant update on table "public"."simulation_questions" to "service_role";

grant delete on table "public"."simulation_reading_answers" to "anon";

grant insert on table "public"."simulation_reading_answers" to "anon";

grant references on table "public"."simulation_reading_answers" to "anon";

grant select on table "public"."simulation_reading_answers" to "anon";

grant trigger on table "public"."simulation_reading_answers" to "anon";

grant truncate on table "public"."simulation_reading_answers" to "anon";

grant update on table "public"."simulation_reading_answers" to "anon";

grant delete on table "public"."simulation_reading_answers" to "authenticated";

grant insert on table "public"."simulation_reading_answers" to "authenticated";

grant references on table "public"."simulation_reading_answers" to "authenticated";

grant select on table "public"."simulation_reading_answers" to "authenticated";

grant trigger on table "public"."simulation_reading_answers" to "authenticated";

grant truncate on table "public"."simulation_reading_answers" to "authenticated";

grant update on table "public"."simulation_reading_answers" to "authenticated";

grant delete on table "public"."simulation_reading_answers" to "service_role";

grant insert on table "public"."simulation_reading_answers" to "service_role";

grant references on table "public"."simulation_reading_answers" to "service_role";

grant select on table "public"."simulation_reading_answers" to "service_role";

grant trigger on table "public"."simulation_reading_answers" to "service_role";

grant truncate on table "public"."simulation_reading_answers" to "service_role";

grant update on table "public"."simulation_reading_answers" to "service_role";

grant delete on table "public"."simulation_sentence_exercises" to "anon";

grant insert on table "public"."simulation_sentence_exercises" to "anon";

grant references on table "public"."simulation_sentence_exercises" to "anon";

grant select on table "public"."simulation_sentence_exercises" to "anon";

grant trigger on table "public"."simulation_sentence_exercises" to "anon";

grant truncate on table "public"."simulation_sentence_exercises" to "anon";

grant update on table "public"."simulation_sentence_exercises" to "anon";

grant delete on table "public"."simulation_sentence_exercises" to "authenticated";

grant insert on table "public"."simulation_sentence_exercises" to "authenticated";

grant references on table "public"."simulation_sentence_exercises" to "authenticated";

grant select on table "public"."simulation_sentence_exercises" to "authenticated";

grant trigger on table "public"."simulation_sentence_exercises" to "authenticated";

grant truncate on table "public"."simulation_sentence_exercises" to "authenticated";

grant update on table "public"."simulation_sentence_exercises" to "authenticated";

grant delete on table "public"."simulation_sentence_exercises" to "service_role";

grant insert on table "public"."simulation_sentence_exercises" to "service_role";

grant references on table "public"."simulation_sentence_exercises" to "service_role";

grant select on table "public"."simulation_sentence_exercises" to "service_role";

grant trigger on table "public"."simulation_sentence_exercises" to "service_role";

grant truncate on table "public"."simulation_sentence_exercises" to "service_role";

grant update on table "public"."simulation_sentence_exercises" to "service_role";

grant delete on table "public"."simulation_sentence_results" to "anon";

grant insert on table "public"."simulation_sentence_results" to "anon";

grant references on table "public"."simulation_sentence_results" to "anon";

grant select on table "public"."simulation_sentence_results" to "anon";

grant trigger on table "public"."simulation_sentence_results" to "anon";

grant truncate on table "public"."simulation_sentence_results" to "anon";

grant update on table "public"."simulation_sentence_results" to "anon";

grant delete on table "public"."simulation_sentence_results" to "authenticated";

grant insert on table "public"."simulation_sentence_results" to "authenticated";

grant references on table "public"."simulation_sentence_results" to "authenticated";

grant select on table "public"."simulation_sentence_results" to "authenticated";

grant trigger on table "public"."simulation_sentence_results" to "authenticated";

grant truncate on table "public"."simulation_sentence_results" to "authenticated";

grant update on table "public"."simulation_sentence_results" to "authenticated";

grant delete on table "public"."simulation_sentence_results" to "service_role";

grant insert on table "public"."simulation_sentence_results" to "service_role";

grant references on table "public"."simulation_sentence_results" to "service_role";

grant select on table "public"."simulation_sentence_results" to "service_role";

grant trigger on table "public"."simulation_sentence_results" to "service_role";

grant truncate on table "public"."simulation_sentence_results" to "service_role";

grant update on table "public"."simulation_sentence_results" to "service_role";

grant delete on table "public"."simulation_sessions" to "anon";

grant insert on table "public"."simulation_sessions" to "anon";

grant references on table "public"."simulation_sessions" to "anon";

grant select on table "public"."simulation_sessions" to "anon";

grant trigger on table "public"."simulation_sessions" to "anon";

grant truncate on table "public"."simulation_sessions" to "anon";

grant update on table "public"."simulation_sessions" to "anon";

grant delete on table "public"."simulation_sessions" to "authenticated";

grant insert on table "public"."simulation_sessions" to "authenticated";

grant references on table "public"."simulation_sessions" to "authenticated";

grant select on table "public"."simulation_sessions" to "authenticated";

grant trigger on table "public"."simulation_sessions" to "authenticated";

grant truncate on table "public"."simulation_sessions" to "authenticated";

grant update on table "public"."simulation_sessions" to "authenticated";

grant delete on table "public"."simulation_sessions" to "service_role";

grant insert on table "public"."simulation_sessions" to "service_role";

grant references on table "public"."simulation_sessions" to "service_role";

grant select on table "public"."simulation_sessions" to "service_role";

grant trigger on table "public"."simulation_sessions" to "service_role";

grant truncate on table "public"."simulation_sessions" to "service_role";

grant update on table "public"."simulation_sessions" to "service_role";

grant delete on table "public"."student_answers" to "anon";

grant insert on table "public"."student_answers" to "anon";

grant references on table "public"."student_answers" to "anon";

grant select on table "public"."student_answers" to "anon";

grant trigger on table "public"."student_answers" to "anon";

grant truncate on table "public"."student_answers" to "anon";

grant update on table "public"."student_answers" to "anon";

grant delete on table "public"."student_answers" to "authenticated";

grant insert on table "public"."student_answers" to "authenticated";

grant references on table "public"."student_answers" to "authenticated";

grant select on table "public"."student_answers" to "authenticated";

grant trigger on table "public"."student_answers" to "authenticated";

grant truncate on table "public"."student_answers" to "authenticated";

grant update on table "public"."student_answers" to "authenticated";

grant delete on table "public"."student_answers" to "service_role";

grant insert on table "public"."student_answers" to "service_role";

grant references on table "public"."student_answers" to "service_role";

grant select on table "public"."student_answers" to "service_role";

grant trigger on table "public"."student_answers" to "service_role";

grant truncate on table "public"."student_answers" to "service_role";

grant update on table "public"."student_answers" to "service_role";

grant delete on table "public"."students" to "anon";

grant insert on table "public"."students" to "anon";

grant references on table "public"."students" to "anon";

grant select on table "public"."students" to "anon";

grant trigger on table "public"."students" to "anon";

grant truncate on table "public"."students" to "anon";

grant update on table "public"."students" to "anon";

grant delete on table "public"."students" to "authenticated";

grant insert on table "public"."students" to "authenticated";

grant references on table "public"."students" to "authenticated";

grant select on table "public"."students" to "authenticated";

grant trigger on table "public"."students" to "authenticated";

grant truncate on table "public"."students" to "authenticated";

grant update on table "public"."students" to "authenticated";

grant delete on table "public"."students" to "service_role";

grant insert on table "public"."students" to "service_role";

grant references on table "public"."students" to "service_role";

grant select on table "public"."students" to "service_role";

grant trigger on table "public"."students" to "service_role";

grant truncate on table "public"."students" to "service_role";

grant update on table "public"."students" to "service_role";

grant delete on table "public"."submissions" to "anon";

grant insert on table "public"."submissions" to "anon";

grant references on table "public"."submissions" to "anon";

grant select on table "public"."submissions" to "anon";

grant trigger on table "public"."submissions" to "anon";

grant truncate on table "public"."submissions" to "anon";

grant update on table "public"."submissions" to "anon";

grant delete on table "public"."submissions" to "authenticated";

grant insert on table "public"."submissions" to "authenticated";

grant references on table "public"."submissions" to "authenticated";

grant select on table "public"."submissions" to "authenticated";

grant trigger on table "public"."submissions" to "authenticated";

grant truncate on table "public"."submissions" to "authenticated";

grant update on table "public"."submissions" to "authenticated";

grant delete on table "public"."submissions" to "service_role";

grant insert on table "public"."submissions" to "service_role";

grant references on table "public"."submissions" to "service_role";

grant select on table "public"."submissions" to "service_role";

grant trigger on table "public"."submissions" to "service_role";

grant truncate on table "public"."submissions" to "service_role";

grant update on table "public"."submissions" to "service_role";

grant delete on table "public"."tzav_rishon_results" to "anon";

grant insert on table "public"."tzav_rishon_results" to "anon";

grant references on table "public"."tzav_rishon_results" to "anon";

grant select on table "public"."tzav_rishon_results" to "anon";

grant trigger on table "public"."tzav_rishon_results" to "anon";

grant truncate on table "public"."tzav_rishon_results" to "anon";

grant update on table "public"."tzav_rishon_results" to "anon";

grant delete on table "public"."tzav_rishon_results" to "authenticated";

grant insert on table "public"."tzav_rishon_results" to "authenticated";

grant references on table "public"."tzav_rishon_results" to "authenticated";

grant select on table "public"."tzav_rishon_results" to "authenticated";

grant trigger on table "public"."tzav_rishon_results" to "authenticated";

grant truncate on table "public"."tzav_rishon_results" to "authenticated";

grant update on table "public"."tzav_rishon_results" to "authenticated";

grant delete on table "public"."tzav_rishon_results" to "service_role";

grant insert on table "public"."tzav_rishon_results" to "service_role";

grant references on table "public"."tzav_rishon_results" to "service_role";

grant select on table "public"."tzav_rishon_results" to "service_role";

grant trigger on table "public"."tzav_rishon_results" to "service_role";

grant truncate on table "public"."tzav_rishon_results" to "service_role";

grant update on table "public"."tzav_rishon_results" to "service_role";


  create policy "admin_reads_own_row"
  on "public"."admins"
  as permissive
  for select
  to authenticated
using (((email)::text = ( SELECT (auth.jwt() ->> 'email'::text))));



  create policy "teacher_reads_own_row"
  on "public"."class_teachers"
  as permissive
  for select
  to authenticated
using (((teacher_email)::text = ( SELECT (auth.jwt() ->> 'email'::text))));



  create policy "teacher_reads_own_class_monitor_channel"
  on "realtime"."messages"
  as permissive
  for select
  to authenticated
using (((EXISTS ( SELECT 1
   FROM public.class_teachers ct
  WHERE (((ct.teacher_email)::text = ( SELECT (auth.jwt() ->> 'email'::text))) AND (ct.lesson_group IS NULL) AND (realtime.topic() = (('class:'::text || (ct.class_id)::text) || ':all'::text))))) OR (EXISTS ( SELECT 1
   FROM public.class_teachers ct
  WHERE (((ct.teacher_email)::text = ( SELECT (auth.jwt() ->> 'email'::text))) AND (ct.lesson_group IS NOT NULL) AND (realtime.topic() = ((('class:'::text || (ct.class_id)::text) || ':group:'::text) || (ct.lesson_group)::text))))) OR (EXISTS ( SELECT 1
   FROM public.admins a
  WHERE (((a.email)::text = ( SELECT (auth.jwt() ->> 'email'::text))) AND (realtime.topic() ~~ 'class:%:all'::text))))));



