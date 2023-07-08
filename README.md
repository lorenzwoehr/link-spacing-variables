
# Figma plugin: Link spacing variables

Effortlessly link spacing variables to your design system, ensuring consistency and efficiency throughout the design process.

[![button](https://github.com/lorenzwoehr/link-spacing-variables/assets/5892374/ea407f30-ca79-4aeb-8863-961599a0bae1)](https://www.figma.com/community/plugin/1258541120380373830)


 ![cover-art](https://github.com/lorenzwoehr/link-spacing-variables/assets/5892374/12421cd5-6b2c-48ed-b4bb-42b5fc8bee41)

## Getting Started
Before installing, you'll need to compile the code using the TypeScript compiler. To install TypeScript, first [install Node.js](https://nodejs.org/en/download/). Then:
```
$ npm install -g typescript
```

Next install the packages that the plugin depends on:
```
$ git clone https://github.com/lorenzwoehr/link-spacing-variables
$ cd link-spacing-variables
$ npm install
```

Compile the Link Spacing Variables plugin:
```
$ npm run build
```

Now you can import the Bar Chart plugin from within the Figma desktop app (`Plugins > Development > Import plugin from manifest...` from the right-click menu)!


## How it works
**1. Create a collection:** Start by creating a collection that contains all your spacing variables (e.g. `xs`, `sm`, `md` etc.)

**2. Select the layer(s):** Choose the layer(s) in your design that you want to link with the spacing variables. These layers can include groups, frames, or individual elements.

**3. Run `Apply spacing variables`** command from the plugin menu. If it's your first time using the plugin, it will prompt you to specify the collection that holds the spacing variables. No worries - we'll save that selection.

**4. Automatic linking ✨:** The plugin will automatically link all selected layers and any nested layers that utilize autolayout to the corresponding spacing keys in your collection.

**⚠️ Spacing variables won't be linked to nested instances:** The plugin ignores nested instances of components within your selected layer(s) to prevent accidental overriding of values. You still have the flexibility to manually override values by explicitly selecting individual instances or layers within an instance.

**⚠️ Ensure the frame's mode matches spacing collection to apply correct values:** If your spacing collection offers different modes based on viewport widths (e.g., desktop or mobile), it's crucial to ensure that the frame you're working on is set to the appropriate mode. This way, the plugin will apply the correct spacing values according to the chosen mode. Learn more about modes for variables.

### Changing spacings collection
To change the spacing collection, simply navigate to the `Apply spacing variables > Settings`.
