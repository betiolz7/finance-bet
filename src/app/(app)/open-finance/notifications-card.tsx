import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, secondaryButtonClass } from "@/components/ui";
import {
  isEmailConfigured,
  notificationsConfig,
  webhookUrl,
} from "@/lib/notifications";
import { listWebhooks } from "@/lib/pluggy";
import { activateNotifications, sendTestEmail } from "./notification-actions";

async function isActive(url: string | null): Promise<boolean | null> {
  if (!url) return false;
  try {
    const hooks = await listWebhooks();
    return hooks.some((hook) => hook.url === url && hook.event === "transactions/created");
  } catch {
    return null;
  }
}

/** Aviso por e-mail quando entra dinheiro numa conta conectada. */
export async function NotificationsCard() {
  const config = notificationsConfig();
  const emailReady = isEmailConfigured();
  const url = webhookUrl(config.appUrl);
  const active = emailReady && config.webhookSecret ? await isActive(url) : false;

  return (
    <Card className="mb-4">
      <h2 className="mb-1 font-semibold">Aviso de entrada por e-mail</h2>
      <p className="mb-3 text-sm text-muted">
        Quando chegar dinheiro numa conta conectada, você recebe um e-mail. O aviso
        sai quando a Pluggy atualiza os dados, normalmente uma vez por dia, e não no
        momento do Pix.
      </p>

      {!emailReady || !config.webhookSecret || !url ? (
        <p className="text-sm">
          Falta configurar as variáveis RESEND_API_KEY, NOTIFY_EMAIL_TO,
          PLUGGY_WEBHOOK_SECRET e APP_URL. Os avisos só funcionam no site publicado,
          porque a Pluggy não consegue chamar o seu computador.
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          {active === true && (
            <span className="text-sm font-medium text-income">✓ Avisos ativos</span>
          )}
          {active === null && (
            <span className="text-sm text-muted">Não foi possível conferir na Pluggy.</span>
          )}
          {active !== true && (
            <ActionForm action={activateNotifications}>
              <SubmitButton>Ativar avisos</SubmitButton>
            </ActionForm>
          )}
          <ActionForm action={sendTestEmail}>
            <SubmitButton className={secondaryButtonClass}>Enviar e-mail de teste</SubmitButton>
          </ActionForm>
        </div>
      )}
    </Card>
  );
}
