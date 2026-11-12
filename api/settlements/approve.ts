import { withAuth, createHandlerContext } from "../_lib/middleware.js";
import { handleApproveSettlement } from "../../functions/src/settlementOperations.js";

export default withAuth(async (req, _res, context) => {
  return handleApproveSettlement(req.body, createHandlerContext(context.uid, context.token));
});
