import { expect, test } from "bun:test";
import {
  DesignInputAnchor,
  DesignInputAnchors,
  RefinementMap,
  RefinementMapAcquisition,
  RefinementMapIdentifier,
  RefinementUnitMaps,
} from "@deep-spec-analysis/design-domain";
import { ArtifactPath, ContentHash } from "@deep-spec-analysis/kernel-domain";

test("取得した精緻化の証跡は呼出元の入力配列が変わっても変化しない", () => {
  const hash = ContentHash.ofText("fixture");
  const path = ArtifactPath.of("map.md");
  const map = RefinementMap.of({
    id: RefinementMapIdentifier.of(path),
    requirementsIrHash: hash,
    designIrHash: hash,
    units: RefinementUnitMaps.of([]),
    sourceDocument: new Uint8Array(),
  });
  const input = [DesignInputAnchor.of({ artifact: "original.md", sha256: hash })];
  const acquisition = RefinementMapAcquisition.loaded(map, path, DesignInputAnchors.of(input));
  input.splice(0, 1, DesignInputAnchor.of({ artifact: "replacement.md", sha256: hash }));
  expect(
    acquisition.match({
      absent: () => [],
      loaded: (_map, _path, anchors) => [...anchors].map((anchor) => anchor.artifact()),
    }),
  ).toEqual(["original.md"]);
});
