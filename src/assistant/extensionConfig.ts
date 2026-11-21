import type { ReactNode } from 'react';

export { getAssistantExtensionConfig, type AssistantExtensionManifest } from '@grafana/assistant';

// Assistant supports these inline turn props before the SDK version allowed by our release-age policy.
export interface InlineChitTurn {
  readonly isStreaming: boolean;
  readonly tools: ReadonlyArray<{ input: unknown; name: string; toolCallId?: string }>;
}

export interface InlineChitProps {
  children?: ReactNode;
  turn?: InlineChitTurn;
}
