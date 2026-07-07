/** Character create screen (BB order: class → name → derived section ID). */

import { MenuScreenLayout } from "../templates/menu-screen-layout";
import { CharacterCreateForm } from "../organisms/character-create-form";

export function CreatePage() {
  return (
    <MenuScreenLayout title="Create Character" back={{ label: "Back", screen: "select" }}>
      <CharacterCreateForm />
    </MenuScreenLayout>
  );
}
