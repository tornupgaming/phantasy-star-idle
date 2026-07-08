/** Character select screen (ui-navigation, character-roster). */

import { MenuScreenLayout } from "../templates/menu-screen-layout";
import { CharacterRoster } from "../organisms/character-roster";

export function SelectPage() {
  return (
    <MenuScreenLayout title="Phantasy Star Idle — Select Character">
      <CharacterRoster />

      <div class="mt-8">
        <div>
          <label>Button List</label>
          <button>normal</button>
        </div>
      </div>
    </MenuScreenLayout>
  );
}
