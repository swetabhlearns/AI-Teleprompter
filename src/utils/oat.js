export function showOatToast(message, title, options) {
  const toastApi = globalThis?.ot?.toast;

  if (!toastApi) {
    console.warn('Oat toast API is unavailable');
    return;
  }

  toastApi(message, title, options);
}
