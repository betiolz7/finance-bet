// Fica separado para o proxy poder importar sem carregar módulos do Node.
export const WEBHOOK_PATH = "/api/pluggy/webhook";
export const WEBHOOK_SECRET_HEADER = "x-webhook-secret";
export const MONTHLY_SUMMARY_CRON_PATH = "/api/cron/resumo-mensal";

/** Rotas chamadas por serviços externos, sem login. Cada uma tem a própria senha. */
export const EXTERNAL_PATHS = [WEBHOOK_PATH, MONTHLY_SUMMARY_CRON_PATH];
