import mesetaIconUrl from "../../assets/meseta_icon.png";

export function MesetaIcon() {
  return (
    <img
      class="meseta-icon w-3.5 h-3.5 object-contain flex-none [image-rendering:pixelated]"
      src={mesetaIconUrl}
      alt="Meseta"
    />
  );
}
