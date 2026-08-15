import { withAuth, createHandlerContext } from "../_lib/middleware.js";
import { handleUnsettleExpenseSplit } from "../../functions/src/settlementOperations.js";

export default withAuth(async (req, _res, context) => {
  return handleUnsettleExpenseSplit(req.body, createHandlerContext(context.uid, context.token));
});
