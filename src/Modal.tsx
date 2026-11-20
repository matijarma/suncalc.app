import { useLayoutEffect, useRef } from "preact/hooks";
import type { ComponentChildren } from "preact";
import { X } from "lucide-preact";
export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ComponentChildren;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useLayoutEffect(() => {
    const d = ref.current!,
      trigger = document.activeElement;
    d.showModal();
    return () => {
      d.close();
      if (trigger instanceof HTMLElement && trigger.isConnected)
        trigger.focus({ preventScroll: true });
    };
  }, []);
  useLayoutEffect(() => {
    const d = ref.current!;
    (
      d.querySelector<HTMLElement>("[data-autofocus],input:checked") ??
      d.querySelector<HTMLElement>(".sheet-title")
    )?.focus({ preventScroll: true });
  }, [title]);
  return (
    <dialog
      class="dialog"
      ref={ref}
      aria-labelledby="modal-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target !== ref.current) return;
        const r = ref.current!.getBoundingClientRect();
        if (
          e.clientX < r.left ||
          e.clientX > r.right ||
          e.clientY < r.top ||
          e.clientY > r.bottom
        )
          onClose();
      }}
    >
      <div class="sheet-head">
        <div>
          <span class="over">SunCalc</span>
          <h2 id="modal-title" class="sheet-title" tabIndex={-1}>
            {title}
          </h2>
        </div>
        <button class="action" aria-label="Close dialog" onClick={onClose}>
          <X size={19} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
