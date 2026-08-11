import { withAuth, createHandlerContext } from "../_lib/middleware.js";
import { handleUpdateBudget } from "../../functions/src/budgetOperations.js";

export default withAuth(async (req, _res, context) => {
  return handleUpdateBudget(req.body, createHandlerContext(context.uid, context.token));
});
