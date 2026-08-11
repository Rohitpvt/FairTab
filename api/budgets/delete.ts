import { withAuth, createHandlerContext } from "../_lib/middleware.js";
import { handleDeleteBudget } from "../../functions/src/budgetOperations.js";

export default withAuth(async (req, _res, context) => {
  return handleDeleteBudget(req.body, createHandlerContext(context.uid, context.token));
});
