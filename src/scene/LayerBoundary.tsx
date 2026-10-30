import { Component, type ErrorInfo, type ReactNode } from 'react';

/**
 * Keeps the altar running when one layer of the scene fails: the failing layer is skipped and the
 * error is logged (with its component stack) for the next build, never shown to a visitor
 * (docs/experience.md, design rule 2: failures stay silent). Reset by changing `resetKey` (a new
 * visit).
 */
export class LayerBoundary extends Component<
  { name: string; resetKey?: string | number; children: ReactNode },
  { failed: boolean; key?: string | number }
> {
  state = { failed: false, key: this.props.resetKey };

  static getDerivedStateFromProps(
    props: { resetKey?: string | number },
    state: { failed: boolean; key?: string | number },
  ) {
    if (props.resetKey !== state.key) {
      return { failed: false, key: props.resetKey };
    }
    return null;
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[Sendero] layer "${this.props.name}" failed: ${error?.message}\n${info.componentStack ?? ''}`);
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}
