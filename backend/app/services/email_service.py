import logging
import smtplib
from email.message import EmailMessage
from html import escape

from app.core.config import settings

logger = logging.getLogger(__name__)


def send_password_reset_email(*, recipient_email: str, recipient_name: str, reset_link: str):
    subject = "Reset your Purple password"
    raw_name = recipient_name.strip() or "there"
    safe_name = escape(raw_name)
    safe_link = escape(reset_link, quote=True)
    expiry_minutes = settings.password_reset_token_expire_minutes

    text_body = (
        f"Hi {raw_name},\n\n"
        "We received a request to reset your Purple password.\n"
        f"Open this link to create a new password:\n{reset_link}\n\n"
        f"This link expires in {expiry_minutes} minutes and can only be used once.\n"
        "If you did not request this reset, you can ignore this email.\n"
    )

    html_body = f"""
    <!DOCTYPE html>
    <html lang=\"en\" xmlns=\"http://www.w3.org/1999/xhtml\">
      <head>
        <meta charset=\"UTF-8\" />
        <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" />
        <meta http-equiv=\"X-UA-Compatible\" content=\"IE=edge\" />
        <meta name=\"x-apple-disable-message-reformatting\" />
        <title>{subject}</title>
        <style>
          body, table, td, a {{
            -webkit-text-size-adjust: 100%;
            -ms-text-size-adjust: 100%;
          }}
          table, td {{
            mso-table-lspace: 0pt;
            mso-table-rspace: 0pt;
          }}
          img {{
            border: 0;
            height: auto;
            line-height: 100%;
            outline: none;
            text-decoration: none;
          }}
          table {{
            border-collapse: collapse !important;
          }}
          body {{
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            background-color: #edf2ff;
          }}
          .wrapper {{
            width: 100%;
            table-layout: fixed;
            background-color: #edf2ff;
            padding: 24px 0;
          }}
          .container {{
            width: 100%;
            max-width: 680px;
            margin: 0 auto;
          }}
          .card {{
            background-color: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 28px;
          }}
          .hero {{
            background: linear-gradient(180deg, #eef2ff 0%, #ffffff 100%);
          }}
          .eyebrow {{
            display: inline-block;
            padding: 10px 14px;
            border: 1px solid #dbeafe;
            border-radius: 999px;
            font-size: 11px;
            line-height: 11px;
            font-weight: 700;
            letter-spacing: 0.18em;
            text-transform: uppercase;
            color: #4f46e5;
            background-color: #eef2ff;
          }}
          .logo-mark {{
            width: 56px;
            height: 56px;
            border-radius: 18px;
            background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
            color: #ffffff;
            font-size: 22px;
            font-weight: 700;
            line-height: 56px;
            text-align: center;
          }}
          .title {{
            font-size: 34px;
            line-height: 1.12;
            font-weight: 800;
            letter-spacing: -0.03em;
            color: #0f172a;
          }}
          .body-copy {{
            font-size: 16px;
            line-height: 1.75;
            color: #475569;
          }}
          .meta-cell {{
            width: 33.33%;
            padding: 0 6px;
          }}
          .meta-card {{
            border: 1px solid #dbeafe;
            border-radius: 18px;
            background-color: #f8fbff;
            padding: 16px 10px;
            text-align: center;
          }}
          .meta-label {{
            font-size: 10px;
            line-height: 1.2;
            font-weight: 700;
            letter-spacing: 0.16em;
            text-transform: uppercase;
            color: #94a3b8;
          }}
          .meta-value {{
            font-size: 14px;
            line-height: 1.4;
            font-weight: 700;
            color: #0f172a;
            padding-top: 8px;
          }}
          .panel {{
            border: 1px solid #dbeafe;
            border-radius: 24px;
            background-color: #f8fbff;
          }}
          .button {{
            display: inline-block;
            padding: 15px 28px;
            border-radius: 18px;
            background: linear-gradient(90deg, #4f46e5 0%, #7c3aed 100%);
            color: #ffffff !important;
            font-size: 15px;
            line-height: 15px;
            font-weight: 700;
            text-decoration: none;
          }}
          .note {{
            border: 1px solid #e2e8f0;
            border-radius: 18px;
            background-color: #ffffff;
            font-size: 14px;
            line-height: 1.7;
            color: #475569;
          }}
          .footer {{
            font-size: 12px;
            line-height: 1.8;
            color: #94a3b8;
          }}
          .mobile-hide {{
            display: block;
          }}
          @media screen and (max-width: 640px) {{
            .wrapper {{
              padding: 12px 0 !important;
            }}
            .container {{
              width: 100% !important;
            }}
            .stack,
            .meta-cell {{
              display: block !important;
              width: 100% !important;
            }}
            .meta-cell {{
              padding: 0 0 10px 0 !important;
            }}
            .px {{
              padding-left: 20px !important;
              padding-right: 20px !important;
            }}
            .pt {{
              padding-top: 24px !important;
            }}
            .pb {{
              padding-bottom: 24px !important;
            }}
            .title {{
              font-size: 28px !important;
              line-height: 1.18 !important;
            }}
            .body-copy {{
              font-size: 15px !important;
              line-height: 1.7 !important;
            }}
            .button {{
              display: block !important;
              width: 100% !important;
              box-sizing: border-box !important;
              text-align: center !important;
            }}
            .center-mobile {{
              text-align: center !important;
            }}
          }}
        </style>
      </head>
      <body>
        <div style=\"display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;\">
          Use your secure one-time link to reset your Purple password.
        </div>

        <table role=\"presentation\" border=\"0\" cellpadding=\"0\" cellspacing=\"0\" width=\"100%\" class=\"wrapper\">
          <tr>
            <td align=\"center\">
              <table role=\"presentation\" border=\"0\" cellpadding=\"0\" cellspacing=\"0\" width=\"100%\" class=\"container\">
                <tr>
                  <td align=\"center\" style=\"padding:0 16px 16px 16px;\">
                    <span class=\"eyebrow\">Purple Security</span>
                  </td>
                </tr>

                <tr>
                  <td style=\"padding:0 16px;\">
                    <table role=\"presentation\" border=\"0\" cellpadding=\"0\" cellspacing=\"0\" width=\"100%\" class=\"card\">
                      <tr>
                        <td class=\"hero px pt\" style=\"padding:36px 36px 16px 36px;border-top-left-radius:28px;border-top-right-radius:28px;\">
                          <div class=\"logo-mark\">P</div>
                          <div style=\"padding-top:22px;font-size:13px;line-height:1.3;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#6366f1;\">
                            Password Reset
                          </div>
                          <div class=\"title\" style=\"padding-top:12px;\">
                            Reset your account password
                          </div>
                          <div class=\"body-copy\" style=\"padding-top:18px;\">
                            Hi {safe_name}, we received a request to reset the password for your Purple workspace. Use the secure button below to create a new password.
                          </div>
                        </td>
                      </tr>

                      <tr>
                        <td class=\"px\" style=\"padding:8px 30px 0 30px;\">
                          <table role=\"presentation\" border=\"0\" cellpadding=\"0\" cellspacing=\"0\" width=\"100%\">
                            <tr>
                              <td class=\"meta-cell\">
                                <div class=\"meta-card\">
                                  <div class=\"meta-label\">Recovery</div>
                                  <div class=\"meta-value\">Email Link</div>
                                </div>
                              </td>
                              <td class=\"meta-cell\">
                                <div class=\"meta-card\">
                                  <div class=\"meta-label\">Access</div>
                                  <div class=\"meta-value\">One-Time Use</div>
                                </div>
                              </td>
                              <td class=\"meta-cell\">
                                <div class=\"meta-card\">
                                  <div class=\"meta-label\">Expiry</div>
                                  <div class=\"meta-value\">{expiry_minutes} Minutes</div>
                                </div>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>

                      <tr>
                        <td class=\"px pb\" style=\"padding:22px 36px 36px 36px;\">
                          <table role=\"presentation\" border=\"0\" cellpadding=\"0\" cellspacing=\"0\" width=\"100%\" class=\"panel\">
                            <tr>
                              <td class=\"px pt pb center-mobile\" style=\"padding:24px 24px 24px 24px;\">
                                <div style=\"font-size:14px;line-height:1.75;color:#475569;\">
                                  This link expires in <strong style=\"color:#0f172a;\">{expiry_minutes} minutes</strong> and can only be used once.
                                </div>
                                <table role=\"presentation\" border=\"0\" cellpadding=\"0\" cellspacing=\"0\" align=\"center\" style=\"margin-top:18px;\">
                                  <tr>
                                    <td align=\"center\" bgcolor=\"#5b4cf0\" style=\"border-radius:18px;\">
                                      <a href=\"{safe_link}\" class=\"button\">Reset Password</a>
                                    </td>
                                  </tr>
                                </table>
                                <div style=\"padding-top:18px;font-size:12px;line-height:1.8;color:#64748b;word-break:break-word;\">
                                  If the button does not work, copy and paste this secure link into your browser:<br />
                                  <a href=\"{safe_link}\" style=\"color:#4f46e5;text-decoration:none;word-break:break-all;\">{safe_link}</a>
                                </div>
                              </td>
                            </tr>
                          </table>

                          <div style=\"padding-top:22px;font-size:12px;line-height:1.3;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:#94a3b8;\">
                            Security Notes
                          </div>

                          <table role=\"presentation\" border=\"0\" cellpadding=\"0\" cellspacing=\"0\" width=\"100%\" style=\"padding-top:12px;\">
                            <tr>
                              <td class=\"note\" style=\"padding:14px 16px;\">
                                If you did not request this reset, you can ignore this email. Your current password will remain unchanged.
                              </td>
                            </tr>
                            <tr>
                              <td style=\"height:10px;font-size:0;line-height:0;\">&nbsp;</td>
                            </tr>
                            <tr>
                              <td class=\"note\" style=\"padding:14px 16px;\">
                                For safety, do not forward this email or share the reset link with anyone.
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <tr>
                  <td align=\"center\" style=\"padding:18px 24px 0 24px;\" class=\"footer\">
                    This email was sent by Purple security automation.<br />
                    Keep your store operations secure with trusted account recovery.
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
    """

    if not settings.smtp_host or not settings.smtp_from_email:
        logger.warning(
            "SMTP is not configured. Password reset email for %s was not sent.",
            recipient_email,
        )
        return

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = (
        f"{settings.smtp_from_name} <{settings.smtp_from_email}>"
        if settings.smtp_from_name
        else settings.smtp_from_email
    )
    message["To"] = recipient_email
    message.set_content(text_body)
    message.add_alternative(html_body, subtype="html")

    smtp_client = smtplib.SMTP_SSL if settings.smtp_use_ssl else smtplib.SMTP

    with smtp_client(settings.smtp_host, settings.smtp_port, timeout=30) as server:
        if not settings.smtp_use_ssl and settings.smtp_use_tls:
            server.starttls()

        if settings.smtp_username and settings.smtp_password:
            server.login(settings.smtp_username, settings.smtp_password)

        server.send_message(message)
