export type NotifyTone = "success" | "error" | "info";

export type NotifyPayload = {
  message: string;
  tone?: NotifyTone;
};

export function notify({ message, tone = "info" }: NotifyPayload) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<NotifyPayload>("agrosys-notify", { detail: { message, tone } }));
}
