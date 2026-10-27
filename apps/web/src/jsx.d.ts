import type { JSX as PreactJSX } from "preact";

declare global {
  // TypeScript requires a global JSX namespace for intrinsic element typing.
  // biome-ignore lint/style/noNamespace: ambient JSX.IntrinsicElements bridge for Preact
  namespace JSX {
    type Element = PreactJSX.Element;
    type ElementClass = PreactJSX.ElementClass;
    type ElementAttributesProperty = PreactJSX.ElementAttributesProperty;
    type ElementChildrenAttribute = PreactJSX.ElementChildrenAttribute;
    type IntrinsicAttributes = PreactJSX.IntrinsicAttributes;
    interface IntrinsicElements extends PreactJSX.IntrinsicElements {}
  }
}
