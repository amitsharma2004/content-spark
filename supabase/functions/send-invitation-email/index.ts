import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EMAIL_HTML_TEMPLATE = (recipientEmail: string, role: string, inviterName: string, signupUrl: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#ffffff;font-family:'Inter','Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#ffffff;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
          <!-- Header -->
          <tr>
            <td style="padding:32px 40px 24px;background:linear-gradient(135deg,hsl(160,84%,39%),hsl(270,60%,55%));border-radius:16px 16px 0 0;">
              <h1 style="margin:0;font-family:'Space Grotesk','Helvetica Neue',Arial,sans-serif;font-size:24px;font-weight:700;color:#ffffff;">
                You're Invited! 🎉
              </h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px 40px;background-color:hsl(230,25%,7%);border-left:1px solid hsl(230,18%,16%);border-right:1px solid hsl(230,18%,16%);">
              <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:hsl(210,40%,96%);">
                Hey there! 👋
              </p>
              <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:hsl(210,40%,96%);">
                <strong>${inviterName}</strong> has invited you to join the team as <strong style="color:hsl(160,84%,39%);">${role}</strong>.
              </p>
              <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:hsl(215,15%,55%);">
                ${role === 'admin'
                  ? 'As an Admin, you\'ll be able to approve content, manage team members, and oversee the full workflow.'
                  : 'As an Editor, you\'ll be able to create and submit content for approval.'}
              </p>
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:8px 0 24px;">
                    <a href="${signupUrl}" target="_blank"
                       style="display:inline-block;padding:14px 32px;background-color:hsl(160,84%,39%);color:hsl(230,25%,7%);font-family:'Space Grotesk','Helvetica Neue',Arial,sans-serif;font-size:16px;font-weight:600;text-decoration:none;border-radius:8px;">
                      Accept Invitation →
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0;font-size:13px;line-height:1.5;color:hsl(215,15%,55%);">
                Sign up with <strong style="color:hsl(210,40%,96%);">${recipientEmail}</strong> to automatically get your role assigned.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px;background-color:hsl(230,20%,10%);border-radius:0 0 16px 16px;border:1px solid hsl(230,18%,16%);border-top:none;">
              <p style="margin:0;font-size:12px;color:hsl(215,15%,55%);text-align:center;">
                If you didn't expect this invitation, you can safely ignore this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GMAIL_SENDER_EMAIL = Deno.env.get("GMAIL_SENDER_EMAIL");
    const GMAIL_APP_PASSWORD = Deno.env.get("GMAIL_APP_PASSWORD");

    if (!GMAIL_SENDER_EMAIL || !GMAIL_APP_PASSWORD) {
      throw new Error("Gmail credentials not configured. Set GMAIL_SENDER_EMAIL and GMAIL_APP_PASSWORD secrets.");
    }

    const { email, role, inviterName } = await req.json();

    if (!email || !role) {
      throw new Error("Missing required fields: email, role");
    }

    // Build signup URL — uses the project's deployed URL
    const origin = req.headers.get("origin") || "https://your-app.vercel.app";
    const signupUrl = `${origin}/auth?email=${encodeURIComponent(email)}`;

    const client = new SMTPClient({
      connection: {
        hostname: "smtp.gmail.com",
        port: 465,
        tls: true,
        auth: {
          username: GMAIL_SENDER_EMAIL,
          password: GMAIL_APP_PASSWORD,
        },
      },
    });

    await client.send({
      from: GMAIL_SENDER_EMAIL,
      to: email,
      subject: `You've been invited to join the team as ${role}!`,
      html: EMAIL_HTML_TEMPLATE(email, role, inviterName || "Your teammate", signupUrl),
    });

    await client.close();

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Email send error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
