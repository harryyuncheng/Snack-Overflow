import { getDB } from "@/lib/store";
export async function POST(req: Request) {
  const db = await getDB();
  const body = await req.json();
  if (body.settings) db.settings = { ...db.settings, ...body.settings, minutes: { ...db.settings.minutes, ...(body.settings.minutes ?? {}) } };
  if (body.office) db.office = { ...db.office, ...body.office };
  return Response.json({ settings: db.settings, office: db.office });
}
