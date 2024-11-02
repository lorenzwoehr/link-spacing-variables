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
    figma.notify("Please select at least one node.", {
      timeout: 2000,
      error: true,
    });
    figma.closePlugin();
  }

  // Fetch both local and library collections asynchronously
  const localCollections = figma.variables.getLocalVariableCollections();
  const libraryCollections =
    await figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync();

  // Merge local and library collections
  const allCollections = [...localCollections, ...libraryCollections];

  // if collections exist, add them to the dropdown
  if (allCollections.length === 0) {
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
  let variableMode: string = ""; // String to hold the resolved variable mode of the selected node

  if (type == "local") {
    // Get local variables
    const localVariables = figma.variables.getVariableCollectionById(id);
    variableIDs = localVariables?.variableIds ?? [];

    // Get variable mode of selected node for local collections. Use default collectin if variable has no selected mode
    if (node.resolvedVariableModes.length)
      variableMode = node.resolvedVariableModes[id];
    else if (localVariables) variableMode = localVariables.defaultModeId;
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

    // Get variable mode of selected node for library collection. FIGMA HACK: Library collection IDs weirdly have a different format than local collections, therefore we need to match the partial ID to the key
    for (const key of Object.keys(node.resolvedVariableModes)) {
      // Check if the key includes the partial ID
      if (key.includes(id)) {
        // Return the value (variable mode) associated with the key
        variableMode = node.resolvedVariableModes[key];
      }
    }
  }

  for (const variableID of variableIDs) {
    // Finally we can handle local and library variables equally
    const variableNode = figma.variables.getVariableById(variableID);

    // Check if the variable node exists and then use it with setBoundVariable
    if (variableNode) {
      const variable = await variableNode; // Make sure to await if getVariableById returns a Promise
      const variableScopes = variableNode.scopes;

      // Fallback: If variableMode is undefined set variableMode to the first mode in the variable.valuesByMode array
      // We don't use variableMode = localVariables.defaultModeId because library collection don't have a default mode
      if (!variableMode) {
        const availableModes = Object.keys(variable.valuesByMode);
        if (availableModes.length > 0) {
          variableMode = availableModes[0]; // Use the first available mode as the fallback
        } else {
          continue; // Skip this variable if no modes are available
        }
      }

      // SCOPE: Link gap (auto layout)
      if (
        (variableScopes.includes("GAP") ||
          variableScopes.includes("ALL_SCOPES")) &&
        (node.type === "FRAME" ||
          node.type === "COMPONENT" ||
          node.type === "COMPONENT_SET" ||
          node.type === "INSTANCE")
      ) {
        const {
          itemSpacing,
          paddingTop,
          paddingRight,
          paddingBottom,
          paddingLeft,
        } = node.inferredAutoLayout ?? {}; // node autolayout spacing

        const nodeVerticalSpacing = node.counterAxisSpacing; // node vertical and horizontal gaps

        if (
          variable &&
          itemSpacing === variable.valuesByMode[variableMode] &&
          node.primaryAxisAlignItems !== "SPACE_BETWEEN"
        ) {
          console.log(
            "ITEM SPACING VAR: " + variable.valuesByMode[variableMode]
          );
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

      // SCOPE: Width and height
      if (
        variableScopes.includes("WIDTH_HEIGHT") ||
        variableScopes.includes("ALL_SCOPES")
      ) {
        const nodeHeight = node.height; // node height
        const nodeWidth = node.width; // node width

        if (variable && nodeWidth === variable.valuesByMode[variableMode]) {
          node.setBoundVariable("width", variable.id);
          variablesSet = true;
        }

        if (variable && nodeHeight === variable.valuesByMode[variableMode]) {
          node.setBoundVariable("height", variable.id);
          variablesSet = true;
        }
      }

      // SCOPE: Corner radius
      if (
        variableScopes.includes("CORNER_RADIUS") ||
        variableScopes.includes("ALL_SCOPES")
      ) {
        // Check if node has single corner radius
        if (node.cornerRadius !== figma.mixed) {
          // Get single corner radius of node
          const nodeCornerRadius = node.cornerRadius;

          if (
            variable &&
            nodeCornerRadius === variable.valuesByMode[variableMode]
          ) {
            //node.setBoundVariable("mixedRadius", variable.id);
            console.log("SET SINGLE CORNER RADIUS");
            node.setBoundVariable("topLeftRadius", variable.id);
            node.setBoundVariable("topRightRadius", variable.id);
            node.setBoundVariable("bottomLeftRadius", variable.id);
            node.setBoundVariable("bottomRightRadius", variable.id);
            variablesSet = true;
          }
        } else {
          // if node has mixed corner radius
          // Get mixed corner radii of node
          const nodeTopLeftRadius = node.topLeftRadius;
          const nodeTopRightRadius = node.topRightRadius;
          const nodeBottomLeftRadius = node.bottomLeftRadius;
          const nodeBottomRightRadius = node.bottomRightRadius;

          if (
            variable &&
            nodeTopLeftRadius === variable.valuesByMode[variableMode]
          ) {
            node.setBoundVariable("topLeftRadius", variable.id);
            variablesSet = true;
          }

          if (
            variable &&
            nodeTopRightRadius === variable.valuesByMode[variableMode]
          ) {
            node.setBoundVariable("topRightRadius", variable.id);
            variablesSet = true;
          }

          if (
            variable &&
            nodeBottomLeftRadius === variable.valuesByMode[variableMode]
          ) {
            node.setBoundVariable("bottomLeftRadius", variable.id);
            variablesSet = true;
          }

          if (
            variable &&
            nodeBottomRightRadius === variable.valuesByMode[variableMode]
          ) {
            node.setBoundVariable("bottomRightRadius", variable.id);
            variablesSet = true;
          }
        }
      }
    }
  }

  if ("children" in node) {
    for (const childNode of node.children) {
      if (childNode.type !== "INSTANCE") {
        await link(childNode, spacingCollectionID);
      }
    }
  }

  figma.closePlugin();
}

// Fetch saved collection from plugin data, return empty string if it has not been set by the user yet
function getSavedCollection() {
  const savedCollection = figma.root.getPluginData("collection");

  // check if saved collection ID is valid
  const valid = dropdownOptions.some(
    (item) => "value" in item && item.value === savedCollection
  );

  return valid ? savedCollection : "";
}

// Save collection ID to plugin data
on<SetCollectionHandler>("SET_COLLECTION", function (collection: string) {
  console.log("Set collection to: " + collection);
  figma.root.setPluginData("collection", collection);
});

// Prompt user
function notifyUser(variablesSet: boolean) {
  if (variablesSet) {
    figma.notify("Linked all selected layers to local variables.", {
      timeout: 2000,
      error: false,
    });
  } else {
    figma.notify("No variables linked in selected layers.", {
      timeout: 2000,
      error: true,
    });
  }
}

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
