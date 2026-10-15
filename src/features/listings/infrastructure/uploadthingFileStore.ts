/**
 * UploadThing implementation of the file store.
 * The token is read from the environment and never logged. A provider
 * refusal throws so the caller can record it and still delete the
 * database rows, which is the behaviour spec 0002 asks for on a purge.
 */
import { UTApi } from "uploadthing/server";
import { env } from "@/core/env";
import type { FileStore } from "../domain/repositories";

/** The provider client. Built once per process, only when a delete is asked for. */
let client: UTApi | null = null;

/** Reads the token and builds the client. Takes nothing, returns the client. Throws loudly when unset. */
function utApi(): UTApi {
  if (client === null) {
    const token = env().UPLOADTHING_TOKEN;
    if (token === undefined || token.length === 0) {
      throw new Error("UPLOADTHING_TOKEN is not set. Add it before purging a listing with screenshots.");
    }
    client = new UTApi({ token });
  }
  return client;
}

/**
 * Deletes stored files by key. Takes the keys, returns nothing.
 * An empty list is a no op, so a listing without screenshots needs no token.
 * Throws when the provider refuses or reports a partial delete.
 */
export async function deleteFiles(fileKeys: readonly string[]): Promise<void> {
  const keys = fileKeys.filter((key) => key.trim().length > 0);
  if (keys.length === 0) {
    return;
  }
  const result = await utApi().deleteFiles([...keys]);
  if (!result.success || result.deletedCount < keys.length) {
    throw new Error(`UploadThing deleted ${result.deletedCount} of ${keys.length} files.`);
  }
}

/** The file store port, assembled from the function above. */
export const fileStore: FileStore = { deleteFiles };