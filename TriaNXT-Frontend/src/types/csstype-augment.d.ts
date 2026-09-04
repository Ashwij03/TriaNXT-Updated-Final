// The legacy components set CSS custom properties via inline style objects
// (e.g. style={{ "--card-color": value }}). csstype does not model custom
// properties by default, so augment its Properties interface with the
// standard template-literal index signature.
import "csstype";

declare module "csstype" {
  interface Properties {
    [key: `--${string}`]: string | number;
  }
}
