export type ToastTone = "info" | "error" | "success";

export interface ToastDetail {
  message: string;
  tone?: ToastTone;
}

export function showToast(message: string, tone: ToastTone = "info"): void {
  document.dispatchEvent(
    new CustomEvent<ToastDetail>("plansage:toast", {
      detail: { message, tone },
    })
  );
}
