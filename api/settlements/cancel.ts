import { withAuth, createHandlerContext } from "../_lib/middleware.js";
import { handleCancelSettlement } from "../../functions/src/settlementOperations.js";

export default withAuth(async (req, _res, context) => {
  return handleCancelSettlement(req.body, createHandlerContext(context.uid, context.token));
});
