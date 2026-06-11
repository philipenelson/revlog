export interface WordmarkClasses {
  wordmark: string;
  wordmarkLight: string;
  wordmarkBold: string;
}

/**
 * The "Revlog" wordmark. Each screen sizes it via its own CSS module, so the
 * class names are injected — markup stays identical everywhere.
 */
export function Wordmark({ classes }: { classes: WordmarkClasses }) {
  return (
    <div className={classes.wordmark}>
      <span className={classes.wordmarkLight}>Rev</span>
      <span className={classes.wordmarkBold}>log</span>
    </div>
  );
}
