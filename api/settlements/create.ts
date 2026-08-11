import { withAuth, createHandlerContext } from "../_lib/middleware.js";
import { handleCreateSettlement } from "../../functions/src/settlementOperations.js";

export default withAuth(async (req, _res, context) => {
  return handleCreateSettlement(req.body, createHandlerContext(context.uid, context.token));
});
