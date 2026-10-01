import { getRamp } from "@/lib/store";
export async function POST(req: Request) {
  const { q } = (await req.json()) as { q: string };
  return Response.json(await (await getRamp()).answerPolicyQuestion(q));
}
