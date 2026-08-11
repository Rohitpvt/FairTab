import { withAuth, createHandlerContext } from "../_lib/middleware.js";
import { handleCreateBudget } from "../../functions/src/budgetOperations.js";

export default withAuth(async (req, _res, context) => {
  return handleCreateBudget(req.body, createHandlerContext(context.uid, context.token));
});
