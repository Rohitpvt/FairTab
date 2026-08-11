import { withAuth, createHandlerContext } from "../_lib/middleware.js";
import { handleDeleteGroup } from "../../functions/src/groupOperations.js";

export default withAuth(async (req, _res, context) => {
  return handleDeleteGroup(req.body, createHandlerContext(context.uid, context.token));
});
