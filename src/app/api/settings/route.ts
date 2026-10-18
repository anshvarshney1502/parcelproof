import { handle, json, body, sameOrigin } from "@/lib/http";
import { requireUserId } from "@/lib/session";
import { settingsInput } from "@/lib/schemas";
import { getSettings, saveSettings } from "@/lib/repo/briefing";
import { usageToday } from "@/lib/repo/usage";
import { limits } from "@/lib/env";

export async function GET() {
  return handle(async () => {
    const userId = await requireUserId();
    const { language, voiceStyle } = await getSettings(userId);
    return json({ settings: { language, voiceStyle }, usage: await usageToday(userId), limits: { ai: limits.aiDailyLimit, tts: limits.ttsDailyLimit } });
  });
}

export async function PUT(req: Request) {
  return handle(async () => {
    sameOrigin(req);
    const userId = await requireUserId();
    await saveSettings(userId, await body(req, settingsInput));
    return json({ ok: true });
  });
}
