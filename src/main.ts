import { DropdownOption } from "@create-figma-plugin/ui";
import { on, once, showUI } from "@create-figma-plugin/utilities";
import {
  SetCollectionHandler,
  LinkSpacingsHandler,
  ShowInterfaceHandler,
} from "./types";

export const nodes: Array<SceneNode> = [];
export const localCollections = figma.variables.getLocalVariableCollections();
export const dropdownOptions: Array<DropdownOption> = [];
export const selectedNodes = figma.currentPage.selection; // currently selected nodes

export function linkVariables() {
  // clear console
  console.clear();
  console.log("Command: Link spacing variables");

  // close plugin if no nodes are selected
  if (selectedNodes.length === 0) {
    console.log("No nodes selected.");
    figma.notify("Please select at least one node.", {
      timeout: 2000,
      error: true,
    });
    figma.closePlugin();
  }

  // if collections exist, add them to the dropdown
  if (localCollections.length === 0) {
    console.log("No local collections found.");
    figma.notify("Please create a variable collection first.", {
      timeout: 2000,
      error: true,
    });
    figma.closePlugin();
  } else {
    for (const collection of localCollections) {
      const item: DropdownOption = {
        value: collection.id,
        text: collection.name,
      };
      dropdownOptions.push(item);
    }
  }

  const collection = getSavedCollection();

  // if collection is selected, link variables
  if (collection !== "") {
    for (const node of selectedNodes) {
      link(node, collection);
    }
    figma.closePlugin();
  }

  showUI(
    {
      height: 140,
      width: 240,
      visible: false,
    },
    {
      collections: dropdownOptions,
      selectedCollection: collection,
    }
  );
}

export function settings() {
  // clear console
  console.clear();
  console.log("Command: Settings");

  // if collections exist, add them to the dropdown
  if (localCollections.length === 0) {
    console.log("No local collections found.");
    figma.notify("Please create a variable collection first.", {
      timeout: 2000,
      error: true,
    });
    figma.closePlugin();
  } else {
    for (const collection of localCollections) {
      const item: DropdownOption = {
        value: collection.id,
        text: collection.name,
      };
      dropdownOptions.push(item);
    }
  }

  const collection = getSavedCollection();

  showUI(
    {
      height: 140,
      width: 240,
    },
    {
      collections: dropdownOptions,
      selectedCollection: collection,
    }
  );
}

function link(node: SceneNode, spacingCollectionID: string) {
  const localVariables =
    figma.variables.getVariableCollectionById(spacingCollectionID);
  const localVariablesIDs = localVariables?.variableIds ?? [];
  let variablesSet = false;

  console.log("Selected collection: " + spacingCollectionID);
  console.log("Selected node: " + node.name + " - " + node.type);

  if (
    (node.type === "FRAME" ||
      node.type === "COMPONENT" ||
      node.type === "COMPONENT_SET" ||
      node.type === "INSTANCE") &&
    node.layoutMode !== "NONE"
  ) {
    const {
      itemSpacing,
      paddingTop,
      paddingRight,
      paddingBottom,
      paddingLeft,
    } = node.inferredAutoLayout ?? {};

    const nodeVerticalSpacing = node.counterAxisSpacing;

    for (const variableID of localVariablesIDs) {
      const variable = figma.variables.getVariableById(variableID);
      const variableMode = node.resolvedVariableModes[spacingCollectionID];

      if (
        variable &&
        itemSpacing === variable.valuesByMode[variableMode] &&
        node.primaryAxisAlignItems !== "SPACE_BETWEEN"
      ) {
        node.setBoundVariable("itemSpacing", variable.id);
        variablesSet = true;
      }

      if (
        variable &&
        node.layoutWrap === "WRAP" &&
        node.counterAxisAlignContent !== "SPACE_BETWEEN" &&
        nodeVerticalSpacing === variable.valuesByMode[variableMode]
      ) {
        node.setBoundVariable("counterAxisSpacing", variable.id);
        variablesSet = true;
        console.log("counterAxisSpacing set");
      }

      if (paddingTop === variable!.valuesByMode[variableMode]) {
        node.setBoundVariable("paddingTop", variable!.id);
        variablesSet = true;
      }

      if (paddingRight === variable!.valuesByMode[variableMode]) {
        node.setBoundVariable("paddingRight", variable!.id);
        variablesSet = true;
      }

      if (paddingBottom === variable!.valuesByMode[variableMode]) {
        node.setBoundVariable("paddingBottom", variable!.id);
        variablesSet = true;
      }

      if (paddingLeft === variable!.valuesByMode[variableMode]) {
        node.setBoundVariable("paddingLeft", variable!.id);
        variablesSet = true;
      }
    }
  }

  if ("children" in node) {
    for (const childNode of node.children) {
      if (childNode.type !== "INSTANCE") link(childNode, spacingCollectionID);
    }
  }

  console.log("Variables set: " + variablesSet);
}

function getSavedCollection() {
  const savedCollection = figma.root.getPluginData("collection");
  const valid = dropdownOptions.some(
    // check if saved collection ID is valid
    (item) => "value" in item && item.value === savedCollection
  );

  return valid ? savedCollection : "";
}

// Save collection ID to plugin data
on<SetCollectionHandler>("SET_COLLECTION", function (collection: string) {
  console.log("Set collection to: " + collection);
  figma.root.setPluginData("collection", collection);
});

// Link spacings
on<LinkSpacingsHandler>("LINK_SPACING", function () {
  console.log("Link spacings");

  const collection = getSavedCollection();
  console.log("Selected collection via getSavedCollection: " + collection);

  // Loop through currently selected nodes
  for (const node of selectedNodes) {
    link(node, collection);
  }

  console.log("Linked all selected layers to local variables.");
  figma.notify("Linked all selected layers to local variables.", {
    timeout: 2000,
    error: false,
  });
});

once<ShowInterfaceHandler>("SHOW_UI", function () {
  console.log("show user interface");
  figma.ui.show();
});
