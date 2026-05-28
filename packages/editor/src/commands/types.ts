export interface HotkeyBinding {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
}

export interface Command {
  id: string;
  label: string;
  shortcut?: HotkeyBinding;
  group?: string;
  order?: number;
  when?: () => boolean;
  handler: () => void;
}
