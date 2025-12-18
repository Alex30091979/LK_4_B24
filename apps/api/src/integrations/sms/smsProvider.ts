export type SmsSendArgs = {
  to: string;
  message: string;
};

export interface SmsProvider {
  sendSms(args: SmsSendArgs): Promise<void>;
}

export class StubSmsProvider implements SmsProvider {
  async sendSms(args: SmsSendArgs) {
    // In dev, we log the SMS so QA can test without real gateway.
    // Do NOT use this provider in production.
    // eslint-disable-next-line no-console
    console.log(`[SMS:STUB] to=${args.to} message="${args.message}"`);
  }
}



