-- Adds the workbook's "הסבר לתשובה הנכונה" (explanation for the correct
-- answer) column, present on every שלמת משפטים row but dropped silently by
-- the importer until now. Nullable: existing rows are null until the
-- importer is re-run; nothing reads this column before this ticket's code
-- ships, so there's no unsafe intermediate state.
alter table naale_questions
  add column explanation text;
