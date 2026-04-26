import type {
  TextInputOptions,
  VibeConfigInput,
  VibeThemeInput,
} from "../ui-config.tsx";

export type {
  TextInputKeyBinding,
  TextInputOptions,
  TextInputShortcut,
  TextInputSpecialKey,
} from "../ui-config.tsx";

export type TextInputProps = {
  value: string;
  onChange: (v: string) => void;
  onSubmit?: (v: string) => void;
  onHistoryPrev?: () => void;
  placeholder?: string;
  placeholderColor?: string;
  config?: VibeConfigInput;
  theme?: VibeThemeInput;
  focus?: boolean;
  options?: TextInputOptions;
  maxUndo?: number;
  tabText?: string | false;
};
