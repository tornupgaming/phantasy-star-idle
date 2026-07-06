import { Show, type JSX } from "solid-js";

import styles from "./panel.module.css";

/**
 * PSU-style dialog window: glossy chamfered blue header bar over a dark navy
 * body with an ice-blue stepped bottom edge. All chrome lives in the
 * CSS module rules in panel.module.css.
 */
function Panel(props: { children: JSX.Element; class?: string }) {
  return (
    <section class={props.class ? `${styles.panel} ${props.class}` : styles.panel}>
      {props.children}
    </section>
  );
}

Panel.Header = function (props: {
  children: JSX.Element;
  /** Optional right-aligned slot (close button, etc.). */
  actions?: JSX.Element;
}) {
  return (
    <header class={styles.header}>
      <div class={styles.headerInner}>
        <span>{props.children}</span>
        <Show when={props.actions}>
          {(actions) => <span class={styles.actions}>{actions()}</span>}
        </Show>
      </div>
    </header>
  );
};

Panel.Body = function (props: { children: JSX.Element }) {
  return (
    <div class={styles.body}>
      <div class={styles.bodyInner}>{props.children}</div>
    </div>
  );
};

export { Panel };
