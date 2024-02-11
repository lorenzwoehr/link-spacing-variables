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

let variablesSet = false; // flag to check if variables have been set

export async function linkVariables() {
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

  // let variables: Array<any> = [];

  // Fetch both local and library collections asynchronously
  const localCollections = figma.variables.getLocalVariableCollections();
  const libraryCollections =
    await figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync();

  // Merge local and library collections
  const allCollections = [...localCollections, ...libraryCollections];

  console.log(allCollections);

  // if collections exist, add them to the dropdown
  if (localCollections.length === 0) {
    console.log("No local collections found.");
    figma.notify("Please create a variable collection first.", {
      timeout: 2000,
      error: true,
    });
    figma.closePlugin();
  } else {
    allCollections.forEach((collection) => {
      let item;
      if ("id" in collection) {
        // Local collection
        item = {
          value: createDropdownValue("local", collection.id),
          text: collection.name,
        };
      } else {
        // Library collection
        item = {
          value: createDropdownValue("library", collection.key),
          text: `${collection.name} (${collection.libraryName})`,
        };
      }
      dropdownOptions.push(item);
    });
  }

  const collection = getSavedCollection();

  // reset flag
  variablesSet = false;

  // if collection is selected, link variables
  if (collection !== "") {
    console.log("LINK VARIABLES");
    for (const node of selectedNodes) {
      await link(node, collection);
    }

    figma.closePlugin();
  }

  notifyUser(variablesSet);

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

export async function settings() {
  // clear console
  console.clear();
  console.log("Command: Settings");

  // Fetch both local and library collections asynchronously
  const localCollections = figma.variables.getLocalVariableCollections();
  const libraryCollections =
    await figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync();

  // Merge local and library collections
  const allCollections = [...localCollections, ...libraryCollections];

  // if collections exist, add them to the dropdown
  if (allCollections.length === 0) {
    console.log("No collections found.");
    figma.notify("Please create or add a variable collection first.", {
      timeout: 2000,
      error: true,
    });
    figma.closePlugin();
  } else {
    allCollections.forEach((collection) => {
      let item;
      if ("id" in collection) {
        // Local collection
        item = {
          value: createDropdownValue("local", collection.id),
          text: collection.name,
        };
      } else {
        // Library collection
        item = {
          value: createDropdownValue("library", collection.key),
          text: `${collection.name} (${collection.libraryName})`,
        };
      }
      dropdownOptions.push(item);
    });
  }

  // get saved collection from Figma
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

function createDropdownValue(type: string, id: string) {
  return JSON.stringify({ type, id }).replace(/\s+/g, ""); // Remove any whitespace
}

function parseDropdownValue(value: string) {
  try {
    return JSON.parse(value);
  } catch (e) {
    console.error("Error parsing dropdown value:", e);
    return null; // Or a sensible default
  }
}

// function: link selected node and child nodes to variables in collection
async function link(node: SceneNode, spacingCollectionID: string) {
  const { type, id } = parseDropdownValue(spacingCollectionID);

  let variableIDs: Array<any> = []; // Array to hold either local or library variable IDs
  let variableMode: string = "";

  console.log(node.resolvedVariableModes);
  console.log(id);

  if (type == "local") {
    // Get local variables
    const localVariables = figma.variables.getVariableCollectionById(id);
    variableIDs = localVariables?.variableIds ?? [];

    // Get variable mode of selected node for local collections
    variableMode = node.resolvedVariableModes[id];
  }

  if (type == "library") {
    // Get library variables
    const libraryVariables =
      await figma.teamLibrary.getVariablesInLibraryCollectionAsync(id);

    // Import variables from the library collection
    for (const libVar of libraryVariables) {
      try {
        // Import each variable by its key
        const importedVariable = await figma.variables.importVariableByKeyAsync(
          libVar.key
        );

        // Add the imported variable's ID to the array
        if (importedVariable) {
          variableIDs.push(importedVariable.id);
        }
      } catch (error) {
        console.error("Error importing variable:", libVar.key, error);
      }
    }

    // Get variable mode of selected node for library collection. HACK : library collection IDs weirdly have a different format than local collections
    for (const key of Object.keys(node.resolvedVariableModes)) {
      // Check if the key includes the partial ID
      if (key.includes(id)) {
        // Return the value (variable mode) associated with the key
        variableMode = node.resolvedVariableModes[key];
      }
    }

    console.log(variableMode);
  }

  // const test = figma.variables.getVariableById(variableIDs[0]);

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

    for (const variableID of variableIDs) {
      const variable = figma.variables.getVariableById(variableID);
      console.log(variable);

      /* Get variable mode of selected node
      variableMode = node.resolvedVariableModes[id];

      console.log("Variable mode: " + variableMode); */

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
}

function getSavedCollection() {
  const savedCollection = figma.root.getPluginData("collection");

  // check if saved collection ID is valid
  const valid = dropdownOptions.some(
    (item) => "value" in item && item.value === savedCollection
  );

  return valid ? savedCollection : "";
}

function notifyUser(variablesSet: boolean) {
  if (variablesSet) {
    console.log(
      "Linked all selected layers to local variables: " + variablesSet
    );
    figma.notify("Linked all selected layers to local variables.", {
      timeout: 2000,
      error: false,
    });
  } else {
    console.log("No variables linked in selected layers.");
    figma.notify("No variables linked in selected layers.", {
      timeout: 2000,
      error: true,
    });
  }
}

// Save collection ID to plugin data
on<SetCollectionHandler>("SET_COLLECTION", function (collection: string) {
  console.log("Set collection to: " + collection);
  figma.root.setPluginData("collection", collection);
});

// Link spacings
on<LinkSpacingsHandler>("LINK_SPACING", async function () {
  console.log("Link spacings");

  const collection = getSavedCollection();
  console.log("Selected collection via getSavedCollection: " + collection);

  // reset flag
  variablesSet = false;

  // Loop through currently selected nodes
  for (const node of selectedNodes) {
    await link(node, collection);
  }

  notifyUser(variablesSet);
});

once<ShowInterfaceHandler>("SHOW_UI", function () {
  console.log("show user interface");
  figma.ui.show();
});
