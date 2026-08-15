import { withAuth, createHandlerContext } from "../_lib/middleware.js";
import { handleSettleExpenseSplit } from "../../functions/src/settlementOperations.js";

export default withAuth(async (req, _res, context) => {
  return handleSettleExpenseSplit(req.body, createHandlerContext(context.uid, context.token));
});
