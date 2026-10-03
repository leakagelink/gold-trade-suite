import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOGO_URL = "https://yuvdzfkgepxchlgxxqmd.supabase.co/storage/v1/object/public/email-assets/logo.png";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AuthEmailRequest {
  email: string;
  type: "signup" | "recovery";
  redirectTo?: string;
}

const brandEmail = (title: string, gradient: string, body: string) => `
  <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; font-family: Arial, sans-serif; border: 1px solid #e5e7eb;">
    <div style="text-align: center; padding: 30px 20px 20px; background: #ffffff;">
      <img src="${LOGO_URL}" alt="SkyFX Trade" style="max-width: 180px; height: auto; margin-bottom: 10px;" />
    </div>
    <div style="background: ${gradient}; padding: 30px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: 700;">${title}</h1>
    </div>
    <div style="padding: 30px; color: #374151; font-size: 15px; line-height: 1.6;">
      ${body}
    </div>
    <div style="background: #0a1f17; padding: 25px 20px; text-align: center;">
      <p style="margin: 0 0 8px; color: #10b981; font-size: 16px; font-weight: 700; letter-spacing: 1px;">SkyFX Trade</p>
      <p style="margin: 0; color: #86efac; font-size: 12px;">Trade Smart. Grow Fast.</p>
      <p style="margin: 12px 0 0; color: #6b7280; font-size: 11px;">© ${new Date().getFullYear()} SkyFX Trade. All rights reserved.</p>
    </div>
  </div>
`;

const button = (url: string, label: string) => `
  <div style="text-align: center; margin: 28px 0;">
    <a href="${url}" style="display: inline-block; background: #0d9488; color: #ffffff; text-decoration: none; padding: 14px 36px; border-radius: 8px; font-size: 16px; font-weight: 700;">${label}</a>
  </div>
  <p style="font-size: 12px; color: #6b7280; word-break: break-all;">Button not working? Copy this link: <a href="${url}" style="color: #0d9488;">${url}</a></p>
`;

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: "Email service not configured" }), {
        status: 500, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { email, type, redirectTo }: AuthEmailRequest = await req.json();

    if (!email || !email.includes("@")) {
      return new Response(JSON.stringify({ error: "Valid email is required" }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    if (type !== "signup" && type !== "recovery") {
      return new Response(JSON.stringify({ error: "Invalid type" }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data, error } = await supabase.auth.admin.generateLink({
      type,
      email: email.trim(),
      options: redirectTo ? { redirectTo } : undefined,
    });

    if (error) {
      console.error("generateLink error:", error.message);
      const msg = error.message.toLowerCase();
      if (type === "signup" && msg.includes("already") && msg.includes("confirm")) {
        return new Response(JSON.stringify({ error: "already_confirmed" }), {
          status: 409, headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
      // Don't leak whether the account exists
      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const actionLink = data.properties?.action_link;
    if (!actionLink) {
      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const isRecovery = type === "recovery";
    const subject = isRecovery
      ? "Reset Your SkyFX Trade Password"
      : "Verify Your SkyFX Trade Account";
    const html = isRecovery
      ? brandEmail("Password Reset", "linear-gradient(135deg, #1e3a5f, #0d9488)", `
          <p>Hello,</p>
          <p>We received a request to reset the password for your SkyFX Trade account. Click the button below to set a new password:</p>
          ${button(actionLink, "Reset Password")}
          <p style="font-size: 13px; color: #6b7280;">This link expires in 1 hour. If you didn't request a password reset, you can safely ignore this email.</p>
        `)
      : brandEmail("Verify Your Email", "linear-gradient(135deg, #0d9488, #10b981)", `
          <p>Hello,</p>
          <p>Welcome to SkyFX Trade! Please confirm your email address to activate your account:</p>
          ${button(actionLink, "Verify My Account")}
          <p style="font-size: 13px; color: #6b7280;">This link expires in 24 hours. If you didn't create an account, you can safely ignore this email.</p>
        `);

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "SkyFX Trade <noreply@growfxtrade.com>",
        to: [email.trim()],
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error(`Resend failed [${res.status}]: ${errBody}`);
      return new Response(
        JSON.stringify({ error: "Failed to send email", details: errBody }),
        { status: res.status, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    console.log(`Auth email (${type}) sent to ${email}`);
    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (err) {
    console.error("auth-email-resend error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
