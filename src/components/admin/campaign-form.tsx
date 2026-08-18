"use client";

import {
  Eye,
  Heading2,
  Image as ImageIcon,
  Loader2,
  Minus,
  MousePointerClick,
  Pilcrow,
  Send,
  TestTube,
} from "lucide-react";
import { useActionState, useRef, useState, useTransition } from "react";

import {
  sendCampaign,
  sendCampaignTest,
  saveCampaign,
} from "@/app/actions/admin/campaigns";
import { uploadImage } from "@/app/actions/admin/content";
import { Panel } from "@/components/admin/ui";
import { Field, FormMessage, SubmitButton } from "@/components/ui/form";
import { IDLE, type FormState } from "@/lib/form-state";

/**
 * El editor de una campana.
 *
 * No es un editor visual y es deliberado. El HTML de correo no se puede
 * generar con las herramientas normales —Outlook descarta hojas de estilo,
 * `flex` y `grid`—, asi que un editor visual honesto tendria que producir
 * tablas anidadas, y uno deshonesto produciria correos que se ven bien aca y
 * rotos en la mitad de las bandejas.
 *
 * En su lugar: bloques listos que se insertan con un boton y ya vienen escritos
 * como el correo los necesita, el HTML a la vista para el que quiera ajustarlo,
 * y una vista previa al lado. Quien escribe la campana no tiene que saber HTML
 * para armarla, pero puede meter mano si sabe.
 */

/** Los bloques, ya escritos como el correo los necesita. */
const BLOQUES = {
  titulo: `<h2 style="margin:28px 0 12px;font:700 20px/1.3 Georgia,'Times New Roman',serif;color:#141218;">Un título</h2>`,
  parrafo: `<p style="margin:0 0 14px;">Escribe aquí. Puedes usar {{nombre}} para saludar a cada socio por su nombre.</p>`,
  separador: `<hr style="margin:26px 0;border:0;border-top:1px solid #e4dfd7;">`,
  boton: `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
  <tr><td align="center" bgcolor="#b4111b" style="border-radius:2px;">
    <a href="https://" style="display:inline-block;padding:14px 28px;font:600 16px/1 Helvetica,Arial,sans-serif;color:#ffffff;text-decoration:none;">Ver más</a>
  </td></tr>
</table>`,
};

export type CampaignDraft = {
  id: string;
  name: string;
  subject: string;
  preheader: string | null;
  html: string;
  audience: "SUSCRITOS" | "TODOS" | "PRUEBA";
  status: "DRAFT" | "SENDING" | "SENT" | "FAILED";
  sentCount: number;
  failedCount: number;
  totalCount: number;
};

export function CampaignForm({
  campaign,
  suscritos,
  todos,
  siteUrl,
}: {
  campaign?: CampaignDraft;
  /** Cuantos socios recibirian cada audiencia, para decirlo antes de mandar. */
  suscritos: number;
  todos: number;
  siteUrl: string;
}) {
  const [state, action] = useActionState(saveCampaign, IDLE);
  const [html, setHtml] = useState(campaign?.html ?? BLOQUES.parrafo);
  const [audience, setAudience] = useState(campaign?.audience ?? "SUSCRITOS");
  const [previa, setPrevia] = useState(true);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  const enviada = campaign ? campaign.status !== "DRAFT" : false;

  /** Inserta donde esta el cursor, no al final: es donde uno esta mirando. */
  const insertar = (fragmento: string) => {
    const area = areaRef.current;

    if (!area) {
      setHtml((actual) => `${actual}\n${fragmento}`);
      return;
    }

    const inicio = area.selectionStart;
    const fin = area.selectionEnd;
    const nuevo = `${html.slice(0, inicio)}\n${fragmento}\n${html.slice(fin)}`;

    setHtml(nuevo);

    // El cursor queda despues de lo insertado, listo para seguir escribiendo.
    requestAnimationFrame(() => {
      area.focus();
      const pos = inicio + fragmento.length + 2;
      area.setSelectionRange(pos, pos);
    });
  };

  const alcance =
    audience === "SUSCRITOS" ? suscritos : audience === "TODOS" ? todos : 0;

  return (
    <div className="flex flex-col gap-6">
      <form action={action} className="flex flex-col gap-6">
        {campaign && <input type="hidden" name="id" value={campaign.id} />}
        <input type="hidden" name="html" value={html} />

        <FormMessage state={state} />

        {enviada && (
          <p className="border border-gilt/40 bg-gilt/10 px-4 py-3 text-sm text-gilt-soft">
            Esta campaña ya se envió a {campaign?.sentCount} socios y no se puede
            editar. Lo que la gente recibió no se puede cambiar.
          </p>
        )}

        <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
          <div className="flex flex-col gap-6">
            <Panel title="El correo">
              <div className="flex flex-col gap-5">
                <Field
                  label="Asunto"
                  name="subject"
                  defaultValue={campaign?.subject}
                  required
                  disabled={enviada}
                  hint="Es lo primero y a veces lo único que se lee."
                  error={state.errors?.subject}
                />

                <Field
                  label="Línea de vista previa"
                  name="preheader"
                  defaultValue={campaign?.preheader ?? ""}
                  disabled={enviada}
                  hint="El texto gris que Gmail muestra junto al asunto. Si lo dejas vacío, se ve el comienzo del correo."
                  error={state.errors?.preheader}
                />
              </div>
            </Panel>

            <Panel title="Contenido">
              {/* La barra de bloques: cada uno inserta HTML de correo ya
                  escrito, para no obligar a nadie a recordar que un botón se
                  hace con una tabla. */}
              {!enviada && (
                <div className="mb-3 flex flex-wrap gap-2">
                  <BlockButton icon={Heading2} onClick={() => insertar(BLOQUES.titulo)}>
                    Título
                  </BlockButton>
                  <BlockButton icon={Pilcrow} onClick={() => insertar(BLOQUES.parrafo)}>
                    Párrafo
                  </BlockButton>
                  <ImageBlockButton
                    onInsert={(url) =>
                      insertar(
                        `<img src="${siteUrl}${url}" alt="" width="544" style="display:block;width:100%;max-width:544px;height:auto;margin:20px 0;border:0;">`,
                      )
                    }
                  />
                  <BlockButton
                    icon={MousePointerClick}
                    onClick={() => insertar(BLOQUES.boton)}
                  >
                    Botón
                  </BlockButton>
                  <BlockButton icon={Minus} onClick={() => insertar(BLOQUES.separador)}>
                    Separador
                  </BlockButton>

                  <button
                    type="button"
                    onClick={() => setPrevia((valor) => !valor)}
                    className="ml-auto flex h-9 items-center gap-2 border border-line px-3 text-xs text-muted transition-colors hover:border-crimson hover:text-bone"
                  >
                    <Eye className="size-3.5" aria-hidden />
                    {previa ? "Ocultar vista previa" : "Ver vista previa"}
                  </button>
                </div>
              )}

              <textarea
                ref={areaRef}
                value={html}
                onChange={(event) => setHtml(event.target.value)}
                disabled={enviada}
                rows={18}
                spellCheck={false}
                aria-label="Contenido del correo en HTML"
                className="w-full border border-line bg-ink px-3 py-2 font-mono text-xs leading-relaxed text-bone focus:border-crimson focus:outline-none disabled:opacity-60"
              />

              {state.errors?.html && (
                <p className="mt-2 text-sm text-crimson-bright">{state.errors.html}</p>
              )}

              <p className="mt-2 text-xs text-muted-dark">
                Escribe <code className="text-gilt-soft">{"{{nombre}}"}</code> donde
                quieras el nombre de cada socio.
              </p>
            </Panel>
          </div>

          <div className="flex flex-col gap-6">
            <Panel title="A quién le llega">
              <div className="flex flex-col gap-2">
                <AudienceOption
                  value="SUSCRITOS"
                  current={audience}
                  onSelect={setAudience}
                  disabled={enviada}
                  label="Socios suscritos"
                  detail={`${suscritos} personas · aceptaron recibir novedades`}
                />
                <AudienceOption
                  value="TODOS"
                  current={audience}
                  onSelect={setAudience}
                  disabled={enviada}
                  label="Todos los socios"
                  detail={`${todos} personas · solo para avisos de servicio`}
                />
              </div>

              <input type="hidden" name="audience" value={audience} />

              {audience === "TODOS" && (
                <p className="mt-3 border border-crimson/40 bg-crimson/10 px-3 py-2 text-xs text-crimson-bright">
                  Incluye a quienes dijeron que no querían novedades. Úsalo solo
                  para avisos de servicio —un cambio de horario, el local
                  cerrado—, nunca para promociones.
                </p>
              )}
            </Panel>

            <Panel title="Guardar">
              <Field
                label="Nombre interno"
                name="name"
                defaultValue={campaign?.name}
                required
                disabled={enviada}
                hint="Solo para encontrarla en la lista. El socio no lo ve."
                error={state.errors?.name}
              />

              {!enviada && (
                <div className="mt-5">
                  <SubmitButton className="w-full" pendingLabel="Guardando…">
                    Guardar borrador
                  </SubmitButton>
                </div>
              )}

              {campaign && (
                <p className="mt-4 text-xs text-muted-dark">
                  {enviada
                    ? `Enviada a ${campaign.sentCount} de ${campaign.totalCount}${campaign.failedCount > 0 ? ` · ${campaign.failedCount} fallaron` : ""}`
                    : `Al enviar llegaría a ${alcance} ${alcance === 1 ? "persona" : "personas"}.`}
                </p>
              )}
            </Panel>
          </div>
        </div>
      </form>

      {/* El envio va fuera del formulario: son acciones sobre lo guardado, no
          sobre lo que hay en pantalla. Mandar lo que todavia no se guardo seria
          mandar algo que nadie reviso. */}
      {campaign && !enviada && <SendPanel campaign={campaign} alcance={alcance} />}

      {previa && (
        <Panel title="Vista previa">
          <div className="overflow-hidden rounded-sm bg-[#f2efe9] p-4">
            <div
              className="mx-auto max-w-[600px] bg-white p-7 text-[#232025]"
              // La previa muestra el HTML tal cual va a salir. Es contenido que
              // escribe el propio administrador del panel, no una fuente
              // externa: el mismo permiso que ya tiene para editar el sitio.
              dangerouslySetInnerHTML={{ __html: html }}
            />
          </div>
        </Panel>
      )}
    </div>
  );
}

/**
 * Enviar: la prueba y el envio real, juntos y en ese orden.
 *
 * La prueba esta a la misma altura del envio y no escondida, porque es el paso
 * que evita el error que no se puede deshacer. Y el envio pide confirmar
 * escribiendo cuantos van a recibirlo: el numero es lo que hace pensar.
 */
function SendPanel({
  campaign,
  alcance,
}: {
  campaign: CampaignDraft;
  alcance: number;
}) {
  const [state, setState] = useState<FormState>(IDLE);
  const [confirmando, setConfirmando] = useState(false);
  const [pending, startTransition] = useTransition();

  const probar = () =>
    startTransition(async () => setState(await sendCampaignTest(campaign.id)));

  const enviar = () =>
    startTransition(async () => {
      setState(await sendCampaign(campaign.id));
      setConfirmando(false);
    });

  return (
    <Panel title="Enviar">
      {state.message && (
        <p
          role="status"
          className={[
            "mb-4 border px-4 py-2 text-sm",
            state.status === "error"
              ? "border-crimson/40 bg-crimson/10 text-crimson-bright"
              : "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
          ].join(" ")}
        >
          {state.message}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={probar}
          className="flex h-12 items-center gap-2 border border-line px-5 text-sm text-bone transition-colors hover:border-crimson disabled:opacity-60"
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <TestTube className="size-4" aria-hidden />
          )}
          Enviarme una prueba
        </button>

        {confirmando ? (
          <>
            <button
              type="button"
              disabled={pending}
              onClick={enviar}
              className="flex h-12 items-center gap-2 bg-crimson px-5 text-sm font-medium text-bone disabled:opacity-60"
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Send className="size-4" aria-hidden />
              )}
              Sí, enviar a {alcance}
            </button>

            <button
              type="button"
              onClick={() => setConfirmando(false)}
              className="h-12 border border-line px-5 text-sm text-muted"
            >
              Cancelar
            </button>
          </>
        ) : (
          <button
            type="button"
            disabled={pending || alcance === 0}
            onClick={() => setConfirmando(true)}
            className="flex h-12 items-center gap-2 bg-crimson px-5 text-sm font-medium text-bone disabled:opacity-40"
          >
            <Send className="size-4" aria-hidden />
            Enviar a {alcance} {alcance === 1 ? "socio" : "socios"}
          </button>
        )}
      </div>

      <p className="mt-3 text-xs text-muted-dark">
        Manda primero la prueba: un correo se ve distinto acá que en Gmail, y es
        el último momento en que se puede arreglar. Una vez enviada no hay vuelta
        atrás.
      </p>
    </Panel>
  );
}

function BlockButton({
  icon: Icon,
  children,
  onClick,
}: {
  icon: typeof Heading2;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-9 items-center gap-2 border border-line px-3 text-xs text-muted transition-colors hover:border-crimson hover:text-bone"
    >
      <Icon className="size-3.5" aria-hidden />
      {children}
    </button>
  );
}

/** Sube una foto y la inserta ya dimensionada para el ancho del correo. */
function ImageBlockButton({ onInsert }: { onInsert: (url: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const subir = (file: File) => {
    const formData = new FormData();
    formData.set("file", file);
    formData.set("preset", "gallery");

    startTransition(async () => {
      const result = await uploadImage(IDLE, formData);

      if (result.status === "error" || !result.data?.url) {
        setError(result.message ?? "No se pudo subir la imagen.");
        return;
      }

      setError(null);
      onInsert(String(result.data.url));
    });
  };

  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={() => inputRef.current?.click()}
        className="flex h-9 items-center gap-2 border border-line px-3 text-xs text-muted transition-colors hover:border-crimson hover:text-bone disabled:opacity-60"
      >
        {pending ? (
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
        ) : (
          <ImageIcon className="size-3.5" aria-hidden />
        )}
        Foto
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) subir(file);
          event.target.value = "";
        }}
      />

      {error && <span className="text-xs text-crimson-bright">{error}</span>}
    </>
  );
}

function AudienceOption({
  value,
  current,
  onSelect,
  disabled,
  label,
  detail,
}: {
  value: "SUSCRITOS" | "TODOS";
  current: string;
  onSelect: (value: "SUSCRITOS" | "TODOS") => void;
  disabled: boolean;
  label: string;
  detail: string;
}) {
  const activo = current === value;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onSelect(value)}
      className={[
        "border px-4 py-3 text-left transition-colors disabled:opacity-60",
        activo ? "border-crimson bg-crimson/10" : "border-line hover:border-bone/30",
      ].join(" ")}
    >
      <span className="block text-sm text-bone">{label}</span>
      <span className="block text-xs text-muted">{detail}</span>
    </button>
  );
}
