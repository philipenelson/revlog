/**
 * The "Revlog" wordmark. Each screen sizes it via its own CSS module — pass the
 * module's styles object; it must define `wordmark`, `wordmarkLight`, and
 * `wordmarkBold`. Markup stays identical everywhere.
 */
export function Wordmark({ classes }: { classes: Record<string, string> }) {
  return (
    <div className={classes.wordmark}>
      <span className={classes.wordmarkLight}>Rev</span>
      <span className={classes.wordmarkBold}>log</span>
    </div>
  );
}
