-- 12 Placeholder Images (ADR 0004, issue #132). Five drawings are gone;
-- every Dish on one moves to the closest left (the handoff's
-- illustrations.json "migration"), deleted Dishes too, so a restored one
-- still has an image. "pasta" and "bowl" keep their keys with new drawings.
UPDATE "dish" SET "placeholder" = CASE "placeholder"
  WHEN 'curry' THEN 'bowl'
  WHEN 'salad' THEN 'bowl'
  WHEN 'porridge' THEN 'breakfast'
  WHEN 'wrap' THEN 'tacos'
  WHEN 'pizza' THEN 'bread'
END
WHERE "placeholder" IN ('curry', 'salad', 'porridge', 'wrap', 'pizza');
