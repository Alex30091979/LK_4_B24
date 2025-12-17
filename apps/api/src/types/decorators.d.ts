import "fastify";
import type { AppConfig } from "../config.js";
import type { SmsProvider } from "../integrations/sms/smsProvider.js";
import type { BitrixService } from "../integrations/bitrix/bitrixService.js";
import type { ReferralService } from "../domain/referrals/referralService.js";
import type { BitrixSyncService } from "../integrations/bitrix/syncService.js";

declare module "fastify" {
  interface FastifyInstance {
    config: AppConfig;
    smsProvider: SmsProvider;
    bitrix: BitrixService;
    referrals: ReferralService;
    bitrixSync: BitrixSyncService;
  }
}


