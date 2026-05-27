import { CollaborationDO } from "./durable-object.js";

export interface Env {
  COLLAB_DO: DurableObjectNamespace<CollaborationDO>;
  COLLAB_STATE: R2Bucket;
  JWT_SECRET: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const documentId = url.pathname.slice(1);
    if (!documentId) {
      return new Response("Missing document ID in path", { status: 400 });
    }

    const id = env.COLLAB_DO.idFromName(documentId);
    const stub = env.COLLAB_DO.get(id);
    return stub.fetch(request);
  },
};
