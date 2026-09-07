// Shared types for admin channel components.

export interface Channel {
  id: string;
  slug: string;
  label: string;
  method: string;
  provider: string;
  channelType: string;
  isActive: boolean;
  sortOrder: number;
  config: Record<string, unknown>;
  isDefaultChannel?: boolean;
  credentialReady: boolean;
}
