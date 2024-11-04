import { DropdownOption } from "@create-figma-plugin/ui";
import { on, once, showUI } from "@create-figma-plugin/utilities";
import {
  SetCollectionHandler,
  LinkSpacingsHandler,
  ShowInterfaceHandler,
  VariableBindableNodePropertyType,
} from "./types";

export const nodes: Array<SceneNode> = [];
/* export const localCollections =
  await figma.variables.getLocalVariableCollectionsAsync(); */
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
  const localCollections =
    await figma.variables.getLocalVariableCollectionsAsync();
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
  const localCollections =
    await figma.variables.getLocalVariableCollectionsAsync();
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
  // Parse the collection ID if necessary
  const { id } = parseDropdownValue(spacingCollectionID);

  // Properties we're interested in
  const properties: Array<VariableBindableNodePropertyType> = [
    "itemSpacing",
    "counterAxisSpacing",
    "paddingTop",
    "paddingRight",
    "paddingBottom",
    "paddingLeft",
    "width",
    "height",
    "topLeftRadius",
    "topRightRadius",
    "bottomLeftRadius",
    "bottomRightRadius",
  ];

  // Check if node has inferredVariables
  if ("inferredVariables" in node && node.inferredVariables) {
    for (const property of properties) {
      const variableAliases = node.inferredVariables[property];

      if (variableAliases && variableAliases.length > 0) {
        for (const variableAlias of variableAliases) {
          const variableId = variableAlias.id;

          // Fetch the variable by ID
          const variable = await figma.variables.getVariableByIdAsync(
            variableId
          );

          if (variable) {
            // Check if the variable belongs to the selected collection
            // STRANGE FIGMA BEHAVIOUR: Library collection IDs weirdly have a different format than local collections, therefore we just check it the selected collection ID is included in variableCollectionId instead of equals
            if (variable.variableCollectionId.includes(id)) {
              const nodePropertyValue = node[property as keyof typeof node];

              // Ensure nodePropertyValue is not undefined and is of a valid type
              if (
                nodePropertyValue !== undefined &&
                (typeof nodePropertyValue === "string" ||
                  typeof nodePropertyValue === "number" ||
                  typeof nodePropertyValue === "boolean")
              ) {
                // Now nodePropertyValue is of type VariableValue
                const variableValues = Object.values(variable.valuesByMode);

                if (variableValues.includes(nodePropertyValue)) {
                  // Bind the variable to the node's property
                  node.setBoundVariable(
                    property as VariableBindableNodePropertyType,
                    variable
                  );
                  variablesSet = true;
                  console.log(
                    `Set variable ${variable.name} to property ${property}`
                  );
                  // Break if you only want to set one variable per property
                  break;
                }
              } else {
                // Handle cases where nodePropertyValue is undefined or not a valid type
                console.warn(
                  `Property ${property} is undefined or not a valid type on node ${node.name}`
                );
              }
            }
          }
        }
      }
    }
  }

  // Recursively process child nodes
  if ("children" in node) {
    for (const childNode of node.children) {
      if (childNode.type !== "INSTANCE") {
        await link(childNode, spacingCollectionID);
      }
    }
  }
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
