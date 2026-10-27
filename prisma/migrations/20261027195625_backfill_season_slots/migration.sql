-- ทีมในฤดูกาลที่มีอยู่ก่อนแล้วยังไม่มีเลขช่อง — ให้เลข 1 … N ตามชื่อทีม
UPDATE "SeasonTeam" st
SET "slot" = numbered.n
FROM (
  SELECT st2."id", ROW_NUMBER() OVER (PARTITION BY st2."seasonId" ORDER BY t."name", st2."id") AS n
  FROM "SeasonTeam" st2
  JOIN "Team" t ON t."id" = st2."teamId"
) AS numbered
WHERE st."id" = numbered."id" AND st."slot" IS NULL;
