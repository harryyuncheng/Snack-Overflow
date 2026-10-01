import { getDB } from "@/lib/store";
import { clusterRequests } from "@/lib/semantic";
export async function GET() { return Response.json(await clusterRequests(await getDB())); }
