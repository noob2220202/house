export function parseOrigins(csv: string | undefined): string[];
export function contentSecurityPolicy(options?: {
  dev?: boolean;
  mediaHosts?: string[];
  postcodeScriptUrl?: string;
}): string;
