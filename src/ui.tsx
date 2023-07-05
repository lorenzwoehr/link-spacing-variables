import {
  Button,
  Container,
  Muted,
  render,
  Text,
  Dropdown,
  DropdownOption,
  VerticalSpace,
} from "@create-figma-plugin/ui";
import { emit } from "@create-figma-plugin/utilities";
import { JSX, h } from "preact";
import { useCallback, useState, useEffect } from "preact/hooks";
import {
  SetCollectionHandler,
  LinkSpacingsHandler,
  ShowInterfaceHandler,
} from "./types";

function Plugin(props: {
  collections: DropdownOption[];
  selectedCollection: string;
}) {
  const [value, setValue] = useState<null | string>(null);
  const collections = props.collections;
  const selectedCollection = props.selectedCollection;

  // initialize dropdown
  useEffect(() => {
    if (selectedCollection !== "") {
      setValue(selectedCollection);
    } else {
      // show ui if no collection has been selected
      emit<ShowInterfaceHandler>("SHOW_UI");
    }
  }, []);

  // handle update dropdown if collections change
  function handleChange(event: JSX.TargetedEvent<HTMLInputElement>) {
    const newValue = event.currentTarget.value;
    setValue(newValue);
    emit<SetCollectionHandler>("SET_COLLECTION", newValue);
  }

  // handle link spacings button click
  const handleLinkSpacingsButtonClick = useCallback(function () {
    emit<LinkSpacingsHandler>("LINK_SPACING");
  }, []);
  return (
    <Container space="medium">
      <VerticalSpace space="large" />
      <Text>
        <Muted>Collection containing the spacing variables</Muted>
      </Text>
      <VerticalSpace space="small" />
      <Dropdown
        onChange={handleChange}
        options={collections}
        value={value}
        placeholder="Choose collection"
        variant="border"
      />
      <VerticalSpace space="small" />
      <Button fullWidth onClick={handleLinkSpacingsButtonClick}>
        Link spacings
      </Button>
      <VerticalSpace space="small" />
    </Container>
  );
}

export default render(Plugin);
