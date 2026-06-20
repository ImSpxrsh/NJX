import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { reconstructTwilioUrl } from "./twilio-url";

const savedEnv = { ...process.env };

beforeEach(() => {
  process.env = { ...savedEnv };
  delete process.env.TWILIO_PUBLIC_BASE_URL;
  delete process.env.PUBLIC_APP_URL;
});

afterEach(() => {
  process.env = { ...savedEnv };
});

function req(url: string, headers: Record<string, string> = {}): Request {
  return new Request(url, { method: "POST", headers });
}

describe("reconstructTwilioUrl", () => {
  it("pins host and scheme from TWILIO_PUBLIC_BASE_URL, ignoring forwarded headers", () => {
    process.env.TWILIO_PUBLIC_BASE_URL = "https://app.example.com";
    const url = reconstructTwilioUrl(
      req("http://internal.local/api/twilio/voice?A=1", {
        "x-forwarded-host": "attacker.example",
        "x-forwarded-proto": "http",
      }),
    );
    expect(url).toBe("https://app.example.com/api/twilio/voice?A=1");
  });

  it("falls back to PUBLIC_APP_URL when no Twilio base is set", () => {
    process.env.PUBLIC_APP_URL = "https://circlecheck.example";
    const url = reconstructTwilioUrl(
      req("http://internal.local/api/twilio/gather"),
    );
    expect(url).toBe("https://circlecheck.example/api/twilio/gather");
  });

  it("reconstructs from forwarded headers behind a proxy", () => {
    const url = reconstructTwilioUrl(
      req("http://10.0.0.5/api/twilio/voice?Digits=1", {
        "x-forwarded-proto": "https",
        "x-forwarded-host": "app.example.com",
      }),
    );
    expect(url).toBe("https://app.example.com/api/twilio/voice?Digits=1");
  });

  it("uses the first hop of comma-separated forwarded headers", () => {
    const url = reconstructTwilioUrl(
      req("http://10.0.0.5/api/twilio/voice", {
        "x-forwarded-proto": "https, http",
        "x-forwarded-host": "app.example.com, internal.local",
      }),
    );
    expect(url).toBe("https://app.example.com/api/twilio/voice");
  });

  it("prefers x-forwarded-host but falls back to the host header", () => {
    const url = reconstructTwilioUrl(
      req("http://10.0.0.5/api/twilio/voice", {
        "x-forwarded-proto": "https",
        host: "host-header.example",
      }),
    );
    expect(url).toBe("https://host-header.example/api/twilio/voice");
  });

  it("always takes the path and query from the request, never a header", () => {
    process.env.TWILIO_PUBLIC_BASE_URL = "https://app.example.com";
    const url = reconstructTwilioUrl(
      req("http://internal.local/api/twilio/gather?Foo=Bar&Baz=1"),
    );
    expect(url).toBe("https://app.example.com/api/twilio/gather?Foo=Bar&Baz=1");
  });
});
