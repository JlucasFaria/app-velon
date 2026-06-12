// Email transport abstraction. Callers depend on the EmailTransport interface,
// not a concrete provider, so swapping the dev logger for a real SMTP/provider
// transport in production is a one-line change at the composition point below.

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
}

export interface EmailTransport {
  send(message: EmailMessage): Promise<void>;
}

// Dev/test transport: logs the message (including any links) as a structured
// JSON line instead of delivering it. Keeps the invite flow fully demonstrable
// with no external mail infrastructure — nothing to misconfigure during a demo.
export class ConsoleEmailTransport implements EmailTransport {
  async send(message: EmailMessage): Promise<void> {
    console.log(
      JSON.stringify({
        type: "email",
        transport: "console",
        to: message.to,
        subject: message.subject,
        html: message.html,
        timestamp: new Date().toISOString(),
      }),
    );
  }
}

// Single transport instance used across the app. A production SMTP/provider
// transport plugs in here (e.g. based on env) without touching any caller.
export const emailTransport: EmailTransport = new ConsoleEmailTransport();
