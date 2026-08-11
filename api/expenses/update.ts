import { withAuth, createHandlerContext } from "../_lib/middleware.js";
import { handleUpdateExpense } from "../../functions/src/expenseOperations.js";

export default withAuth(async (req, _res, context) => {
  return handleUpdateExpense(req.body, createHandlerContext(context.uid, context.token));
});
