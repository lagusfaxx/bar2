"use client";

import { CornerDownLeft, Delete, X } from "lucide-react";
import { useRef } from "react";

/**
 * El teclado del POS.
 *
 * La pantalla tactil del mostrador no tiene teclado: ni fisico, ni el del
 * sistema. Un navegador de kiosco sobre Windows o Linux no levanta ninguno al
 * enfocar un campo, y cuando lo levanta se come media pantalla justo encima de
 * lo que hay que tocar. Con eso, cualquier campo de texto de la app es una
 * pared: el garzon lo toca, no pasa nada, y se queda ahi.
 *
 * Asi que en esa pantalla el teclado lo pone la app: se dibuja adentro del
 * panel, empuja el contenido en vez de taparlo, y lo que se esta escribiendo
 * nunca queda debajo del dedo.
 *
 * En el telefono no. Ahi el del sistema aparece solo, y es mejor que este:
 * corrige, predice, y trae los acentos y la ñ que el garzon usa sin pensar.
 * Quien decide cual va es `useTecladoPropio`, mirando si hay mouse; los
 * campos de la app se montan de solo lectura o editables segun esa respuesta.
 *
 * Las teclas son grandes a proposito. La recomendacion para tactil es no bajar
 * de 44 puntos; en un POS de pie, con el local lleno, van 56 y con aire entre
 * ellas.
 */

/** QWERTY, que es el que todos ya tienen en la cabeza. Con la ñ en su lugar. */
const LETRAS = [
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l", "ñ"],
  ["z", "x", "c", "v", "b", "n", "m"],
] as const;

const DIGITOS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"] as const;

/** Las tres filas del teclado numerico, como en cualquier calculadora. */
const NUMERICO = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
] as const;

export function Keyboard({
  onKey,
  onBackspace,
  onClear,
  onDone,
  doneLabel,
  variant = "texto",
}: {
  /** Una letra o digito. */
  onKey: (char: string) => void;
  onBackspace: () => void;
  /** Borra todo. Sin esto, vaciar un campo son quince toques. */
  onClear: () => void;
  /** Cierra el teclado. En la busqueda no hay nada que confirmar. */
  onDone?: () => void;
  doneLabel?: string;
  /** `numeros` es el pad de la tarjeta: digitos grandes y nada mas. */
  variant?: "texto" | "numeros";
}) {
  if (variant === "numeros") {
    return (
      <div className="shrink-0 border-t border-line bg-ink-soft p-2">
        <div className="mx-auto grid max-w-sm grid-cols-3 gap-2">
          {NUMERICO.flat().map((digito) => (
            <Key key={digito} onPress={() => onKey(digito)} tall>
              {digito}
            </Key>
          ))}

          <Key onPress={onClear} muted tall label="Borrar todo">
            <X className="size-5" aria-hidden />
          </Key>

          <Key onPress={() => onKey("0")} tall>
            0
          </Key>

          <Key onPress={onBackspace} muted tall label="Borrar el último">
            <Delete className="size-5" aria-hidden />
          </Key>
        </div>

        {onDone && (
          <button
            type="button"
            onClick={onDone}
            className="mx-auto mt-2 flex h-14 w-full max-w-sm items-center justify-center gap-2 bg-crimson text-base font-medium text-bone"
          >
            <CornerDownLeft className="size-5" aria-hidden />
            {doneLabel ?? "Listo"}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="shrink-0 border-t border-line bg-ink-soft px-1.5 py-2">
      {/* Los numeros arriba, como en cualquier teclado: hay productos que se
          llaman "Schop 1/2" o "Combo 2". */}
      <div className="flex gap-1.5">
        {DIGITOS.map((digito) => (
          <Key key={digito} onPress={() => onKey(digito)}>
            {digito}
          </Key>
        ))}
      </div>

      {LETRAS.map((fila, indice) => (
        <div key={indice} className="mt-1.5 flex gap-1.5">
          {/* La tercera fila es mas corta: se centra en vez de estirarse, para
              que las teclas no cambien de tamaño de una fila a otra. */}
          {indice === 2 && <span className="flex-[1.5]" aria-hidden />}

          {fila.map((letra) => (
            <Key key={letra} onPress={() => onKey(letra)}>
              {letra}
            </Key>
          ))}

          {indice === 2 && (
            <Key onPress={onBackspace} muted grow={1.5} label="Borrar el último">
              <Delete className="size-5" aria-hidden />
            </Key>
          )}
        </div>
      ))}

      <div className="mt-1.5 flex gap-1.5">
        <Key onPress={onClear} muted grow={2}>
          Borrar todo
        </Key>

        <Key onPress={() => onKey(" ")} grow={4} label="Espacio">
          <span className="text-sm text-muted">espacio</span>
        </Key>

        {onDone && (
          <Key onPress={onDone} accent grow={2}>
            {doneLabel ?? "Listo"}
          </Key>
        )}
      </div>
    </div>
  );
}

/**
 * Una tecla.
 *
 * Dispara en `onPointerDown` y no en `onClick`: en un tactil el click llega
 * recien al soltar y, escribiendo rapido, se pierden letras. Aca la letra sale
 * en cuanto el dedo toca.
 *
 * El `onClick` queda igual, pero solo para quien no usa el dedo. Los campos de
 * la app son de solo lectura —todo entra por aca— asi que si estas teclas
 * respondieran unicamente al puntero, alguien navegando con tabulador o con un
 * lector de pantalla no tendria forma de escribir nada. La bandera evita que
 * un mismo toque cuente dos veces: el puntero ya la marco, y el click que
 * viene detras se descarta.
 */
function Key({
  children,
  onPress,
  muted,
  accent,
  grow = 1,
  tall,
  label,
}: {
  children: React.ReactNode;
  onPress: () => void;
  muted?: boolean;
  accent?: boolean;
  grow?: number;
  tall?: boolean;
  label?: string;
}) {
  const conPuntero = useRef(false);

  return (
    <button
      type="button"
      aria-label={label}
      style={{ flexGrow: grow, flexBasis: 0 }}
      onPointerDown={(event) => {
        // Que el campo no pierda el foco ni aparezca el teclado del sistema.
        event.preventDefault();
        conPuntero.current = true;
        onPress();
      }}
      onClick={() => {
        if (conPuntero.current) {
          conPuntero.current = false;
          return;
        }
        onPress();
      }}
      className={[
        "flex select-none items-center justify-center border text-lg uppercase transition-colors active:bg-crimson active:text-bone",
        tall ? "h-16 text-2xl" : "h-14",
        accent
          ? "border-crimson bg-crimson text-bone"
          : muted
            ? "border-line bg-ink text-muted"
            : "border-line bg-ink text-bone",
      ].join(" ")}
    >
      {children}
    </button>
  );
}
