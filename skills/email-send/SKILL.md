---
name: email-send
description: "Send emails via SMTP using curl or Python's smtplib."
metadata: {"moltbot":{"emoji":"📧","requires":{"bins":["curl"]}}}
---

# Email Send

Send emails via SMTP.

## Environment Variables

- `SMTP_HOST` - SMTP server (e.g. `smtp.gmail.com`)
- `SMTP_PORT` - Port (e.g. `587`)
- `SMTP_USER` - SMTP username/email
- `SMTP_PASSWORD` - SMTP password or app password

## Send with curl

```bash
curl --ssl-reqd \
  --url "smtps://${SMTP_HOST}:${SMTP_PORT}" \
  --user "${SMTP_USER}:${SMTP_PASSWORD}" \
  --mail-from "$SMTP_USER" \
  --mail-rcpt "recipient@example.com" \
  -T - <<EOF
From: $SMTP_USER
To: recipient@example.com
Subject: Hello

Email body here.
EOF
```

## Send with Python

```bash
python3 -c "
import smtplib, os
from email.mime.text import MIMEText
msg = MIMEText('Email body here')
msg['Subject'] = 'Hello'
msg['From'] = os.environ['SMTP_USER']
msg['To'] = 'recipient@example.com'
with smtplib.SMTP(os.environ['SMTP_HOST'], int(os.environ['SMTP_PORT'])) as s:
    s.starttls()
    s.login(os.environ['SMTP_USER'], os.environ['SMTP_PASSWORD'])
    s.send_message(msg)
print('Sent')
"
```

## Notes

- For Gmail, use an App Password (not your account password).
- Always confirm recipient and content with the user before sending.
