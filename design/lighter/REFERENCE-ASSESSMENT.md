# ED 01 lighter — reference assessment

Reviewed the supplied photograph upright and both videos at two frames per second. The two JPEGs are byte-identical; the videos show the same demonstration, rather than independent angles. Extracted review frames are in `reference/`.

## Observed

- Closed front silhouette is approximately 1 wide × 1.69 high. Almost square corners with small machined bevels, not a soft rounded plastic body.
- Lid and lower trim occupy approximately 21% of overall height. A thin joint separates the brushed lid panel from its smoother bottom rail.
- Front chassis has an L-shaped notch at the upper right. The exposed knurled control is approximately 16–18% of width and 44–46% of total height, starting immediately beneath the lid.
- Knurl comprises real, tightly spaced faceted teeth: approximately four visible columns and 18–20 rows on the front. The teeth reflect the respective finish; they are not a contrasting silver pad on the lower face.
- Small circular pivot visible at the upper-left corner of the front body, with an arcing shoulder into the lid rail. Video at roughly 3–4 seconds shows the lid swinging toward the left of the front face, about a depth-aligned pivot. It is not a rear hinge across the width.
- Open lid is hollow. Video at 4 and 8 seconds shows its inset inner panel, thin rim, hinge hardware, and a raised inset deck on the chassis. The burner is toward the control/right end. The precise internal mechanism is obscured and blurred.
- Vertical brushed grain on both large face panels, including occasional stronger scratches. Narrow perimeter bevels and smoother rails catch bright reflections.
- Three finishes: warm muted gold/brass, near-black reflective onyx, reflective silver/steel. Steel is particularly mirror-like beneath the scratches.
- BROKE in a high-contrast serif is centered near 80% of the height measured down from the top. ED 01 and No 01/250 share a baseline near the bottom, left and right respectively. Text is dark on gold, pale on black and silver in the supplied photograph.
- Video demonstrates a narrow blue flame followed by a broader warm flame. Flames emerge from the open deck, not above a closed cap.

## Assumptions and limits

User supplied height **70 mm** and thickness **10 mm**. Width is inferred as **41.42 mm** from the photograph. Blender uses calibrated metric display units, and the GLB exports in metres. The underside, refill hardware, back engraving, and internal valve layout cannot be established from these references. Back is conservatively plain; no invented underside branding or refill mechanism. Burner/deck geometry is an interpretation of visible forms, not a mechanically validated assembly. Serif uses the repository's Gilda Display as the nearest available brand font; the physical engraving's exact font is not confirmed.

## Deliverables and rig contract

`build_lighter.py` generates an editable Blender scene, studio renders, and a web GLB. `LidPivot` is a separate parent so the page can reproduce the observed side opening. Materials beginning `Finish` share the selected colourway; `Engraving` changes contrast. Brushed normal and roughness textures are embedded in the GLB; knurl teeth and bevels are geometry. World axes in Blender: X width, Y depth, Z height; front faces negative Y. glTF export converts to Y up, front positive Z.
