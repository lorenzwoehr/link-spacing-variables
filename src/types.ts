import { EventHandler } from "@create-figma-plugin/utilities";

export type VariableBindableNodePropertyType =
  | "itemSpacing"
  | "counterAxisSpacing"
  | "paddingTop"
  | "paddingRight"
  | "paddingBottom"
  | "paddingLeft"
  | "width"
  | "height"
  | "topLeftRadius"
  | "topRightRadius"
  | "bottomLeftRadius"
  | "bottomRightRadius";

export interface SetCollectionHandler extends EventHandler {
  name: "SET_COLLECTION";
  handler: (collection: string) => void;
}

export interface LinkSpacingsHandler extends EventHandler {
  name: "LINK_SPACING";
  handler: () => void;
}

export interface ShowInterfaceHandler extends EventHandler {
  name: "SHOW_UI";
  handler: () => void;
}
