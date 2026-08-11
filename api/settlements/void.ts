import { withAuth, createHandlerContext } from "../_lib/middleware.js";
import { handleVoidSettlement } from "../../functions/src/settlementOperations.js";

export default withAuth(async (req, _res, context) => {
  return handleVoidSettlement(req.body, createHandlerContext(context.uid, context.token));
});
