const commit = typeof __BUILD_COMMIT__ === "undefined" ? "development" : __BUILD_COMMIT__;
const builtAt = typeof __BUILD_TIME__ === "undefined" ? "local" : __BUILD_TIME__;

/** Deployment fingerprint injected by Vite and visible in every UI regime. */
export function BuildInfo() {
  return (
    <small
      class="pointer-events-none fixed right-2 bottom-1 z-50 font-mono text-[10px] text-muted/60"
      data-build-info
      title={`Commit ${commit}; built ${builtAt}`}
    >
      Build {commit} · {builtAt}
    </small>
  );
}
