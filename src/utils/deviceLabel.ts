// Push subscriptions store the raw navigator.userAgent as device_label at
// subscribe time (see PushSubscriptionSettings). Parse it into a short,
// human name for display — never show the raw UA string to the user.
export function friendlyDeviceLabel(rawLabel: string | null | undefined): string | null {
  if (!rawLabel) return null;

  const ua = rawLabel;
  let browser = 'Unknown browser';
  if (/Edg\//.test(ua)) browser = 'Edge';
  else if (/OPR\//.test(ua)) browser = 'Opera';
  else if (/Chrome\//.test(ua)) browser = 'Chrome';
  else if (/CriOS\//.test(ua)) browser = 'Chrome';
  else if (/FxiOS\//.test(ua)) browser = 'Firefox';
  else if (/Firefox\//.test(ua)) browser = 'Firefox';
  else if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) browser = 'Safari';

  let os = 'Unknown OS';
  if (/iPhone|iPad|iPod/.test(ua)) os = 'iOS';
  else if (/Android/.test(ua)) os = 'Android';
  else if (/Mac OS X/.test(ua)) os = 'macOS';
  else if (/Windows/.test(ua)) os = 'Windows';
  else if (/Linux/.test(ua)) os = 'Linux';

  if (browser === 'Unknown browser' && os === 'Unknown OS') return null;
  return `${browser} on ${os}`;
}
