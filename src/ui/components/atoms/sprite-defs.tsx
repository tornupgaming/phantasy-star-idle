import { spriteDefs } from "../../icons";

/** Hidden <symbol> sprite sheet; rows reference glyphs with <use>. */
export function SpriteDefs() {
  return <span style="display:none" innerHTML={spriteDefs()} />;
}
