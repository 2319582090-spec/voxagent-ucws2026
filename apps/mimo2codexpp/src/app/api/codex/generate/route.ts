import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.json();
  const gatewayBase = String(body.gatewayBase ?? "http://127.0.0.1:4020").replace(/\/+$/, "");

  const payload = {
    authJson: {
      OPENAI_API_KEY: "mimo2codexplusplus-local",
    },
    configToml: [
      `model = "mimo-v2.5-pro"`,
      `model_provider = "mimo"`,
      `model_context_window = 1000000`,
      `model_max_output_tokens = 131072`,
      `model_reasoning_effort = "xhigh"`,
      `disable_response_storage = true`,
      `network_access = "enabled"`,
      ``,
      `[model_providers.mimo]`,
      `name = "mimo2codex++ gateway"`,
      `base_url = "${gatewayBase}/v1"`,
      `wire_api = "responses"`,
      `requires_openai_auth = true`,
      `request_max_retries = 1`,
    ].join("\n"),
  };

  return NextResponse.json(payload);
}
