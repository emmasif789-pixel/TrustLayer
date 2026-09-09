import { NextRequest, NextResponse, after } from "next/server";
import { verifyKey } from "discord-interactions";
import { runFullAnalysis, NoClaimsFoundError } from "@/lib/runAnalysis";
import { verdictHeadline, verdictColorHex } from "@/lib/verdict";
import { supabase } from "@/lib/supabase";
import { checkRateLimit } from "@/lib/rateLimit";

export const maxDuration = 120;

const PUBLIC_KEY = process.env.DISCORD_PUBLIC_KEY;
const APPLICATION_ID = process.env.DISCORD_APPLICATION_ID;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://trustlayer-emma.vercel.app";

function hexToDecimal(hex: string): number {
  return parseInt(hex.replace("#", ""), 16);
}

interface DiscordOption {
  name: string;
  value: string;
}

interface DiscordInteraction {
  type: number;
  token: string;
  member?: { user?: { id: string } };
  user?: { id: string };
  data?: { name: string; options?: DiscordOption[] };
}

async function editOriginalMessage(token: string, body: Record<string, unknown>) {
  await fetch(`https://discord.com/api/v10/webhooks/${APPLICATION_ID}/${token}/messages/@original`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function POST(req: NextRequest) {
  if (!PUBLIC_KEY || !APPLICATION_ID) {
    return NextResponse.json({ error: "Discord bot is not configured on this deployment." }, { status: 501 });
  }

  const signature = req.headers.get("x-signature-ed25519");
  const timestamp = req.headers.get("x-signature-timestamp");
  const rawBody = await req.text();

  const isValid =
    signature && timestamp && (await verifyKey(rawBody, signature, timestamp, PUBLIC_KEY));
  if (!isValid) {
    return new NextResponse("Bad request signature", { status: 401 });
  }

  const interaction = JSON.parse(rawBody) as DiscordInteraction;

  // PING — Discord sends this once when you set the Interactions Endpoint URL.
  if (interaction.type === 1) {
    return NextResponse.json({ type: 1 });
  }

  // Slash command invocation.
  if (interaction.type === 2 && interaction.data?.name === "checkclaim") {
    const claimText = interaction.data.options?.find((o) => o.name === "text")?.value;
    const discordUserId = interaction.member?.user?.id ?? interaction.user?.id ?? "unknown";

    if (!claimText) {
      return NextResponse.json({
        type: 4,
        data: { content: "Give me something to check — e.g. `/checkclaim text: <claim>`" },
      });
    }

    const rateLimit = await checkRateLimit(`discord:${discordUserId}`);
    if (!rateLimit.allowed) {
      return NextResponse.json({
        type: 4,
        data: {
          content: `You're checking claims faster than the free tier allows — try again in about ${Math.ceil(
            (rateLimit.retryAfterSeconds ?? 60) / 60
          )} minute(s).`,
        },
      });
    }

    const token = interaction.token;

    // Discord requires a reply within 3 seconds. The analysis pipeline takes
    // much longer, so we ack immediately with a deferred response, then edit
    // it in with the real result once analysis finishes (`after` keeps this
    // running past the point the HTTP response is sent).
    after(async () => {
      try {
        const result = await runFullAnalysis(claimText);

        let shareUrl: string | undefined;
        if (supabase) {
          const { data: row } = await supabase
            .from("analyses")
            .insert({
              device_id: "discord",
              input_type: result.inputType,
              input_raw: result.inputRaw,
              overall_score: result.trust.overallScore,
              verdict_label: result.trust.verdictLabel,
              result,
            })
            .select("id")
            .single();
          if (row?.id) shareUrl = `${SITE_URL}/analysis/${row.id}`;
        }

        const embed = {
          title: `${verdictHeadline(result.trust)} — ${result.trust.overallScore}/100`,
          description: result.trust.summary,
          color: hexToDecimal(verdictColorHex(result.trust.verdictLabel)),
          fields: [
            {
              name: "Claim",
              value: result.inputRaw.length > 500 ? result.inputRaw.slice(0, 500) + "…" : result.inputRaw,
            },
          ],
          footer: { text: "TrustLayer — evidence-backed, never fabricated" },
        };

        await editOriginalMessage(token, {
          embeds: [embed],
          components: shareUrl
            ? [{ type: 1, components: [{ type: 2, style: 5, label: "Full evidence", url: shareUrl }] }]
            : [],
        });
      } catch (err) {
        const message = err instanceof NoClaimsFoundError ? err.message : "That check failed — try rephrasing it.";
        await editOriginalMessage(token, { content: message });
      }
    });

    return NextResponse.json({ type: 5 }); // deferred, ephemeral not set = visible to channel
  }

  return NextResponse.json({ error: "Unhandled interaction type." }, { status: 400 });
}
