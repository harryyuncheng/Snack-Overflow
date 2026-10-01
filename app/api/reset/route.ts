import { resetDB } from "@/lib/store";
export async function POST() { await resetDB(); return Response.json({ ok: true }); }
