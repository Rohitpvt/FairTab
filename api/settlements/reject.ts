import { withAuth, createHandlerContext } from "../_lib/middleware.js";
import { handleRejectSettlement } from "../../functions/src/settlementOperations.js";

export default withAuth(async (req, _res, context) => {
  return handleRejectSettlement(req.body, createHandlerContext(context.uid, context.token));
});
