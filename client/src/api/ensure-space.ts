import { SpaceRpcError } from "./errors.ts";
import type { createSpaceApi } from "./space.ts";

export const MEMO_SPACE_TYPE = "fyi.afabl.atmemo";
export const MEMO_SPACE_KEY = "self";

export function memoSpaceUri(did: string): string {
  return `at://${did}/space/${MEMO_SPACE_TYPE}/${MEMO_SPACE_KEY}`;
}

export async function ensureSpace(
  api: Pick<ReturnType<typeof createSpaceApi>, "getSpace" | "createSpace">,
  did: string,
): Promise<void> {
  const uri = memoSpaceUri(did);
  try {
    await api.getSpace(uri);
    return;
  } catch (error) {
    if (!(error instanceof SpaceRpcError) || error.error !== "SpaceNotFound")
      throw error;
  }
  try {
    await api.createSpace({
      spaceType: MEMO_SPACE_TYPE,
      skey: MEMO_SPACE_KEY,
      policy: { $type: "com.atproto.personalspace.policy" },
    });
  } catch (error) {
    // Another tab may have created the same Space after the existence check.
    if (!(error instanceof SpaceRpcError) || error.error !== "SpaceAlreadyExists")
      throw error;
  }
  await api.getSpace(uri);
}
